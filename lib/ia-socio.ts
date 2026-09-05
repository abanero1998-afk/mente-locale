"use client";

import { useMenteStore } from "./store";
import { deviceId, publishLocal, publishRemote, supabaseConfigured } from "./sync";
import { getCurrentLocaleId } from "./scoped-storage";
import { getLocale } from "./tenants";
import { useCassa, cassaDayKey, scontrinoAttivo, type ScontrinoCassa } from "./cassa";
import { kpiOggi } from "./dashboard-stats";
import type { IaAzione, IaAzioneKind } from "./types";

function waSocioTo() {
  const loc = getLocale(getCurrentLocaleId());
  const fromTenant = (loc?.settings?.waSocio || "").trim();
  if (fromTenant) return fromTenant;
  return process.env.NEXT_PUBLIC_SOCIO_WA || "+3444106229";
}

const SLOT_HOURS = [17, 19, 21, 23];
const KDS_STALE_MS = 20 * 60 * 1000;
const PULIZIA_STALE_MS = 12 * 60 * 60 * 1000;
const DEDUPE_MS = 40 * 60 * 1000; // ~40 min mid of 30–45
const ZERO_SCONTRINI_MS = 90 * 60 * 1000; // 1.5h senza scontrini in servizio
const QUIET_START = 0;
const QUIET_END = 7;

type PendingIssue = {
  key: string;
  msg: string;
  urgente: boolean;
  azioni?: IaAzione[];
  priority: number;
};

function localePrefix() {
  return getCurrentLocaleId() || "_none";
}

function ssGet(key: string): string | null {
  if (typeof sessionStorage === "undefined") return null;
  try {
    return sessionStorage.getItem(`ml:${localePrefix()}:${key}`);
  } catch {
    return null;
  }
}

function ssSet(key: string, val: string) {
  if (typeof sessionStorage === "undefined") return;
  try {
    sessionStorage.setItem(`ml:${localePrefix()}:${key}`, val);
  } catch {}
}

function wasFiredRecently(key: string, windowMs = DEDUPE_MS): boolean {
  const raw = ssGet(`ia-dedupe-${key}`);
  if (!raw) return false;
  const ts = Number(raw);
  if (!Number.isFinite(ts)) return false;
  return Date.now() - ts < windowMs;
}

function markFired(key: string) {
  ssSet(`ia-dedupe-${key}`, String(Date.now()));
}

function isQuietHours(urgente: boolean): boolean {
  if (urgente) return false;
  const h = new Date().getHours();
  return h >= QUIET_START && h < QUIET_END;
}

function isServiceHours(d = new Date()): boolean {
  const h = d.getHours();
  return (h >= 12 && h < 15) || (h >= 19 && h < 23);
}

function playIaSound(urgente: boolean) {
  const audio = new Audio(urgente ? "/sounds/alarm.wav" : "/sounds/ding-pronto.wav");
  audio.volume = 0.6;
  audio.play().catch(() => {
    try {
      const ctx = new AudioContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.frequency.value = urgente ? 420 : 880;
      gain.gain.value = 0.09;
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + (urgente ? 0.35 : 0.18));
    } catch {}
  });
}

async function notifyPush(msg: string) {
  try {
    if (!("Notification" in window)) return;
    if (Notification.permission !== "granted") return;
    const reg = await navigator.serviceWorker?.ready;
    if (reg?.active) {
      reg.active.postMessage({ type: "NOTIFY", title: "IA Socio", body: msg, tag: "ia-socio", url: "/?tab=haccp" });
    } else {
      new Notification("IA Socio", { body: msg, icon: "/logo-mark.jpg", tag: "ia-socio" });
    }
  } catch {}
}

export function emitIaNav(kind: IaAzioneKind) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent("ml-ia-nav", { detail: { kind } }));
}

function azione(id: string, label: string, kind: IaAzioneKind): IaAzione {
  return { id, label, kind };
}

export async function avvisaSocio(
  msg: string,
  opts?: { urgente?: boolean; azioni?: IaAzione[]; key?: string; skipDedupe?: boolean; skipQuiet?: boolean }
) {
  const urgente =
    opts?.urgente ??
    (msg.includes("🚨") || msg.includes("TEMP FRIGO") || msg.toLowerCase().includes("urgente"));
  const key = opts?.key || msg.slice(0, 80);

  if (!opts?.skipDedupe && wasFiredRecently(key)) return;
  if (!opts?.skipQuiet && isQuietHours(urgente)) return;

  markFired(key);
  useMenteStore.getState().pushAvviso(msg, urgente, { azioni: opts?.azioni, key });
  playIaSound(urgente);
  void notifyPush(msg);
  const ev = {
    kind: "avviso_socio" as const,
    msg,
    urgente,
    deviceId,
    key,
    azioni: opts?.azioni,
  };
  publishLocal(ev);
  if (supabaseConfigured()) await publishRemote(ev);
  if (urgente) {
    try {
      await fetch("/api/whatsapp/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to: waSocioTo(), msg }),
      });
    } catch {}
  }
}

/** Stima età ordine da `ora` HH:MM (oggi); null se non affidabile. */
function etàDaOra(ora: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec((ora || "").trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  const now = new Date();
  const then = new Date(now);
  then.setHours(h, min, 0, 0);
  let diff = now.getTime() - then.getTime();
  if (diff < -30 * 60 * 1000) diff += 24 * 60 * 60 * 1000;
  if (diff < 0 || diff > 18 * 60 * 60 * 1000) return null;
  return diff;
}

function collectIssues(): PendingIssue[] {
  const { tavoli, magazzino, frighi, prenotazioni, pulizie } = useMenteStore.getState();
  const issues: PendingIssue[] = [];

  const critici = magazzino.filter((m) => m.qta < m.soglia || m.qta < 5);
  if (critici.length) {
    issues.push({
      key: "mag-critici",
      msg: `⚠️ Stanno finendo: ${critici.map((m) => m.nome).join(", ")}. Controlla magazzino.`,
      urgente: false,
      priority: 40,
      azioni: [azione("a-mag", "Apri magazzino", "magazzino"), azione("a-haccp", "HACCP", "haccp")],
    });
  }

  const fuori = frighi.filter((f) => f.temp > f.max || f.temp < f.min);
  if (fuori.length) {
    issues.push({
      key: `frigo-out-${fuori[0].id}`,
      msg: `🚨 Frigo ${fuori[0].nome} a ${fuori[0].temp}°C! Chiama tecnico!`,
      urgente: true,
      priority: 100,
      azioni: [azione("a-frigo", "Apri HACCP frighi", "haccp")],
    });
  }

  const lenti = tavoli.filter((t) => t.stato !== "libero" && t.tempo > 60);
  if (lenti.length) {
    issues.push({
      key: `tavolo-lento-${lenti[0].id}`,
      msg: `⏱️ ${lenti[0].nome} occupato da ${lenti[0].tempo}min — sollecita?`,
      urgente: false,
      priority: 35,
      azioni: [azione("a-tav", "Apri tavoli", "tavolo")],
    });
  }

  const daConfermare = prenotazioni.filter((p) => p.stato === "da_confermare");
  if (daConfermare.length) {
    issues.push({
      key: "prenotazioni-da-conf",
      msg: `📅 Prenotazioni da confermare: ${daConfermare.map((p) => `${p.nome} (${p.quando})`).join(", ")}.`,
      urgente: false,
      priority: 45,
      azioni: [azione("a-pren", "Prenotazioni", "prenotazioni")],
    });
  }

  const pulizieOverdue = pulizie.filter((p) => !p.fatto && Date.now() - p.ts > PULIZIA_STALE_MS);
  const puliziePending = pulizie.filter((p) => !p.fatto);
  if (pulizieOverdue.length || puliziePending.length) {
    const zone = (pulizieOverdue.length ? pulizieOverdue : puliziePending).map((p) => p.zona).slice(0, 4);
    issues.push({
      key: "pulizie-pending",
      msg: `🧹 Pulizie incomplete o in ritardo: ${zone.join(", ")}.`,
      urgente: false,
      priority: 30,
      azioni: [azione("a-pul", "Apri HACCP", "haccp")],
    });
  }

  const conto = tavoli.filter((t) => t.stato === "conto");
  if (conto.length) {
    issues.push({
      key: "tavoli-conto",
      msg: `💳 Tavoli in conto da chiudere: ${conto.map((t) => t.nome).join(", ")}.`,
      urgente: false,
      priority: 50,
      azioni: [azione("a-cassa", "Apri cassa", "cassa"), azione("a-tav2", "Tavoli", "tavolo")],
    });
  }

  const kdsStale = tavoli.flatMap((t) =>
    t.ordini
      .filter((o) => o.stato === "ordinato" || o.stato === "in_prep")
      .map((o) => {
        const età = etàDaOra(o.ora);
        return età != null && età > KDS_STALE_MS ? { ...o, tavolo: t.nome, età } : null;
      })
      .filter(Boolean)
  );
  if (kdsStale.length) {
    const first = kdsStale[0] as { tavolo: string; piatto: { nome: string }; età: number };
    const min = Math.round(first.età / 60000);
    issues.push({
      key: "kds-stale",
      msg: `🍳 Ordine KDS fermo da ~${min} min: ${first.tavolo} · ${first.piatto.nome}${
        kdsStale.length > 1 ? ` (+${kdsStale.length - 1})` : ""
      }.`,
      urgente: false,
      priority: 55,
      azioni: [azione("a-kds", "Apri KDS", "kds")],
    });
  }

  // --- Cassa / vendite (solo dati reali useCassa) ---
  const cassaList = useCassa.getState().scontrini;
  issues.push(...collectCassaIssues(cassaList, tavoli));

  return issues;
}

function collectCassaIssues(
  scontrini: ScontrinoCassa[],
  tavoli: { stato: string }[]
): PendingIssue[] {
  const out: PendingIssue[] = [];
  const now = Date.now();
  const oggi = cassaDayKey(now);
  const attiviOggi = scontrini.filter((x) => cassaDayKey(x.ts) === oggi && scontrinoAttivo(x));
  const annullatiOggi = scontrini.filter((x) => cassaDayKey(x.ts) === oggi && x.stato === "annullato");
  const occupied = tavoli.filter((t) => t.stato === "occupato" || t.stato === "conto");

  if (isServiceHours() && occupied.length > 0) {
    const recent = attiviOggi.filter((s) => now - s.ts < ZERO_SCONTRINI_MS);
    if (recent.length === 0 && attiviOggi.length === 0) {
      // Nessuno scontrino oggi e tavoli occupati in fascia servizio
      out.push({
        key: "cassa-zero-servizio",
        msg: `🧾 Fascia di servizio attiva, ${occupied.length} tavoli occupati ma zero scontrini recenti — controlla la cassa.`,
        urgente: false,
        priority: 60,
        azioni: [azione("a-cassa-z", "Apri cassa", "cassa"), azione("a-tav-z", "Tavoli", "tavolo")],
      });
    } else if (recent.length === 0 && attiviOggi.length > 0) {
      const last = Math.max(...attiviOggi.map((s) => s.ts));
      if (now - last >= ZERO_SCONTRINI_MS) {
        const ore = Math.round((now - last) / 3600000);
        out.push({
          key: "cassa-gap",
          msg: `🧾 Nessuno scontrino da ~${ore}h con tavoli occupati — verifica cassa.`,
          urgente: false,
          priority: 58,
          azioni: [azione("a-cassa-g", "Apri cassa", "cassa")],
        });
      }
    }
  }

  // Incasso oggi vs media ultimi 7 giorni (serve ≥3 giorni con dati)
  const dayTotals: Record<string, number> = {};
  for (const s of scontrini) {
    if (!scontrinoAttivo(s)) continue;
    const k = cassaDayKey(s.ts);
    dayTotals[k] = (dayTotals[k] || 0) + (Number(s.totale) || 0);
  }
  const todayTotal = dayTotals[oggi] || 0;
  const pastKeys = Object.keys(dayTotals)
    .filter((k) => k !== oggi)
    .sort()
    .slice(-7);
  if (pastKeys.length >= 3 && isServiceHours()) {
    let sum = 0;
    for (const k of pastKeys) sum += dayTotals[k];
    const media = sum / pastKeys.length;
    if (media > 0 && todayTotal < media * 0.7) {
      out.push({
        key: "cassa-sotto-media",
        msg: `📉 Incasso oggi €${todayTotal.toFixed(0)} sotto ~70% della media 7gg (€${media.toFixed(0)} su ${pastKeys.length} giorni).`,
        urgente: false,
        priority: 42,
        azioni: [azione("a-cassa-m", "Vedi cassa", "cassa")],
      });
    }
  }

  // Spike void
  if (annullatiOggi.length >= 3) {
    const attiviN = attiviOggi.length;
    if (attiviN === 0 || annullatiOggi.length / Math.max(attiviN + annullatiOggi.length, 1) >= 0.25) {
      out.push({
        key: "cassa-void-spike",
        msg: `⛔ Oggi ${annullatiOggi.length} scontrini annullati — verifica eventuali errori in cassa.`,
        urgente: false,
        priority: 48,
        azioni: [azione("a-cassa-v", "Apri cassa", "cassa")],
      });
    }
  }

  return out;
}

export async function runIaCheck() {
  const issues = collectIssues().sort((a, b) => b.priority - a.priority);
  const fresh = issues.filter((i) => !wasFiredRecently(i.key));

  if (!fresh.length) {
    // Skip green "tutto ok" spam — max 1/day
    const okKey = `ok-${cassaDayKey(Date.now())}`;
    if (!ssGet(okKey) && !isQuietHours(false) && issues.length === 0) {
      ssSet(okKey, "1");
      await avvisaSocio("✅ Tutto ok: magazzino, frighi, prenotazioni e tempi sotto controllo.", {
        key: okKey,
        skipDedupe: true,
        azioni: [],
      });
    }
    return;
  }

  if (fresh.length >= 2) {
    const top = fresh.slice(0, 5);
    const lines = top.map((i, idx) => `${idx + 1}. ${i.msg.replace(/^[^A-Za-z0-9À-ÿ⚠️🚨⏱️📅🧹💳🍳🧾📉⛔]+ /, "")}`);
    const urgente = top.some((i) => i.urgente);
    const azioniMap: Record<string, IaAzione> = {};
    for (const i of top) {
      for (const a of i.azioni || []) {
        if (!azioniMap[a.kind]) azioniMap[a.kind] = a;
      }
    }
    const azioni = Object.keys(azioniMap).map((k) => azioniMap[k]).slice(0, 4);
    const digestKey = `digest-${cassaDayKey(Date.now())}-${top.map((t) => t.key).join("|")}`;
    await avvisaSocio(`📋 DIGEST IA Socio — ${top.length} punti:\n${lines.join("\n")}`, {
      urgente,
      key: digestKey,
      azioni,
    });
    for (const i of top) markFired(i.key);
    return;
  }

  const one = fresh[0];
  await avvisaSocio(one.msg, { urgente: one.urgente, key: one.key, azioni: one.azioni });
}

export async function checkFrigoSlot() {
  const now = new Date();
  const hour = now.getHours();
  const minute = now.getMinutes();
  if (!SLOT_HOURS.includes(hour) || minute > 8) return;
  const key = `frigo-slot-${now.toDateString()}-${hour}`;
  if (ssGet(key)) return;
  ssSet(key, "1");
  const { frighi } = useMenteStore.getState();
  const stale = frighi.filter((f) => !f.lastCheck || Date.now() - f.lastCheck > 110 * 60 * 1000);
  if (stale.length) {
    await avvisaSocio(
      `TEMP FRIGO ${hour}:00 — aggiorna temperature (${stale.map((f) => f.nome).join(", ")}). Apri HACCP e clicca AGGIORNATO.`,
      {
        urgente: true,
        key: `temp-frigo-${key}`,
        azioni: [azione("a-frigo-slot", "Apri HACCP", "haccp")],
        skipQuiet: true,
      }
    );
  } else {
    await avvisaSocio(`TEMP FRIGO ${hour}:00 — slot di controllo. Conferma le temperature in HACCP.`, {
      key: `temp-frigo-ok-${key}`,
      azioni: [azione("a-frigo-ok", "Apri HACCP", "haccp")],
    });
  }
}

/** Report sera ~22:30 — una volta al giorno. */
export async function checkReportSera() {
  const now = new Date();
  const h = now.getHours();
  const m = now.getMinutes();
  if (h !== 22 || m < 25 || m > 40) return;
  const day = cassaDayKey(now.getTime());
  const key = `report-sera-${day}`;
  if (ssGet(key)) return;
  ssSet(key, "1");

  const scontrini = useCassa.getState().scontrini;
  const kpi = kpiOggi(scontrini);
  const issues = collectIssues().sort((a, b) => b.priority - a.priority);
  const rischio = issues[0]?.msg || "Nessun rischio aperto rilevato.";
  const msg =
    `🌙 Report sera\n` +
    `• Incasso oggi: €${kpi.totale.toFixed(2)}\n` +
    `• Scontrini: ${kpi.nScontrini}\n` +
    `• Coperti: ${kpi.coperti}\n` +
    `• Rischio: ${rischio}`;
  await avvisaSocio(msg, {
    key,
    skipDedupe: true,
    azioni: [
      azione("a-sera-cassa", "Apri cassa", "cassa"),
      ...(issues[0]?.azioni?.slice(0, 1) || []),
    ],
  });
}

/** Motore locale regole + NL leggero (niente LLM se manca la key). */
export async function replyIaChat(userText: string): Promise<{ msg: string; azioni?: IaAzione[] }> {
  const q = (userText || "").trim().toLowerCase();
  if (!q) return { msg: "Scrivi una domanda, es. «come va la cassa?» o «frighi?»." };

  const local = answerLocalRules(q);

  const apiKey =
    (typeof process !== "undefined" &&
      (process.env.NEXT_PUBLIC_OPENAI_API_KEY ||
        process.env.NEXT_PUBLIC_IA_API_KEY ||
        process.env.OPENAI_API_KEY)) ||
    "";

  if (apiKey && typeof fetch !== "undefined") {
    try {
      // Solo riformulazione: i numeri restano quelli locali (mai inventati)
      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          temperature: 0.3,
          max_tokens: 220,
          messages: [
            {
              role: "system",
              content:
                "Sei IA Socio di un ristorante italiano. Riformula in italiano chiaro i fatti forniti. NON inventare numeri o stati. Se i fatti dicono «dato non disponibile», dillo.",
            },
            {
              role: "user",
              content: `Domanda: ${userText}\n\nFatti verificati dal sistema:\n${local.msg}`,
            },
          ],
        }),
      });
      if (res.ok) {
        const data = (await res.json()) as {
          choices?: { message?: { content?: string } }[];
        };
        const phrased = data.choices?.[0]?.message?.content?.trim();
        if (phrased) return { msg: phrased, azioni: local.azioni };
      }
    } catch {}
  }

  return local;
}

function answerLocalRules(q: string): { msg: string; azioni?: IaAzione[] } {
  const { tavoli, magazzino, frighi, prenotazioni, pulizie } = useMenteStore.getState();
  const scontrini = useCassa.getState().scontrini;
  const kpi = kpiOggi(scontrini);
  const issues = collectIssues().sort((a, b) => b.priority - a.priority);

  if (/cassa|incasso|vendit|scontrin/.test(q)) {
    const ann = scontrini.filter((x) => cassaDayKey(x.ts) === cassaDayKey(Date.now()) && x.stato === "annullato").length;
    return {
      msg:
        `Cassa oggi (dati reali):\n` +
        `• Incasso: €${kpi.totale.toFixed(2)}\n` +
        `• Scontrini: ${kpi.nScontrini}\n` +
        `• Coperti: ${kpi.coperti}` +
        (ann ? `\n• Annullati oggi: ${ann}` : ""),
      azioni: [azione("chat-cassa", "Apri cassa", "cassa")],
    };
  }

  if (/frig|haccp|temperatur/.test(q)) {
    if (!frighi.length) return { msg: "Nessun frigo configurato.", azioni: [azione("chat-h", "HACCP", "haccp")] };
    const lines = frighi.map((f) => {
      const ok = f.temp >= f.min && f.temp <= f.max;
      return `• ${f.nome}: ${f.temp}°C (range ${f.min}–${f.max}) ${ok ? "OK" : "⚠️ FUORI"}`;
    });
    return { msg: `Frighi:\n${lines.join("\n")}`, azioni: [azione("chat-h2", "Apri HACCP", "haccp")] };
  }

  if (/magazzin|scorta|stock|finendo/.test(q)) {
    const critici = magazzino.filter((m) => m.qta < m.soglia || m.qta < 5);
    if (!magazzino.length) return { msg: "Magazzino vuoto / non configurato.", azioni: [azione("chat-m", "Magazzino", "magazzino")] };
    if (!critici.length) return { msg: `Magazzino: ${magazzino.length} articoli, nessuna scorta critica ora.`, azioni: [azione("chat-m2", "Magazzino", "magazzino")] };
    return {
      msg: `Scorta critica:\n${critici.map((m) => `• ${m.nome}: ${m.qta} ${m.unita} (soglia ${m.soglia})`).join("\n")}`,
      azioni: [azione("chat-m3", "Apri magazzino", "magazzino")],
    };
  }

  if (/tavol|sala|occupat/.test(q)) {
    const occ = tavoli.filter((t) => t.stato !== "libero");
    return {
      msg: `Tavoli: ${occ.length} non liberi su ${tavoli.length}.\n${occ
        .slice(0, 8)
        .map((t) => `• ${t.nome}: ${t.stato}${t.tempo ? ` (${t.tempo} min)` : ""}`)
        .join("\n") || "• Tutti liberi"}`,
      azioni: [azione("chat-t", "Apri tavoli", "tavolo")],
    };
  }

  if (/prenot/.test(q)) {
    const open = prenotazioni.filter((p) => p.stato !== "cancellata");
    const daConf = open.filter((p) => p.stato === "da_confermare");
    return {
      msg: `Prenotazioni attive: ${open.length}` + (daConf.length ? ` (${daConf.length} da confermare)` : "") +
        (open.length
          ? `\n${open.slice(0, 6).map((p) => `• ${p.nome} · ${p.quando} · ${p.stato}`).join("\n")}`
          : ""),
      azioni: [azione("chat-p", "Prenotazioni", "prenotazioni")],
    };
  }

  if (/kds|cucina|ordine|ordini/.test(q)) {
    const pending = tavoli.flatMap((t) =>
      t.ordini.filter((o) => o.stato !== "pronto").map((o) => `${t.nome}: ${o.piatto.nome} (${o.stato})`)
    );
    return {
      msg: pending.length ? `KDS aperti (${pending.length}):\n${pending.slice(0, 10).map((l) => `• ${l}`).join("\n")}` : "Nessun ordine aperto in KDS.",
      azioni: [azione("chat-k", "Apri KDS", "kds")],
    };
  }

  if (/puliz/.test(q)) {
    const pend = pulizie.filter((p) => !p.fatto);
    return {
      msg: pend.length
        ? `Pulizie incomplete: ${pend.map((p) => p.zona).join(", ")}.`
        : pulizie.length
          ? "Tutte le pulizie risultano fatte."
          : "Nessuna zona pulizia configurata.",
      azioni: [azione("chat-pul", "HACCP", "haccp")],
    };
  }

  if (/cosa fare|adesso|ora\b|priorit|digest|alert|avvis/.test(q)) {
    if (!issues.length) {
      return { msg: "Nessuna criticità aperta ora. Puoi controllare cassa o frighi.", azioni: [azione("chat-ok-c", "Cassa", "cassa")] };
    }
    const top = issues.slice(0, 3);
    return {
      msg: `Priorità ora:\n${top.map((i, n) => `${n + 1}. ${i.msg}`).join("\n")}`,
      azioni: (top[0].azioni || []).slice(0, 3),
    };
  }

  if (/come va|stato|riepilogo|report/.test(q)) {
    return {
      msg:
        `Riepilogo:\n` +
        `• Cassa oggi: €${kpi.totale.toFixed(2)} · ${kpi.nScontrini} scontrini · ${kpi.coperti} coperti\n` +
        `• Tavoli non liberi: ${tavoli.filter((t) => t.stato !== "libero").length}\n` +
        `• Criticità aperte: ${issues.length}` +
        (issues[0] ? `\n• Top rischio: ${issues[0].msg}` : ""),
      azioni: [azione("chat-r-c", "Cassa", "cassa"), azione("chat-r-h", "HACCP", "haccp")],
    };
  }

  return {
    msg:
      "Posso rispondere su: cassa, frighi, magazzino, tavoli, prenotazioni, KDS, pulizie, «cosa fare ora».\n" +
      `Ora: ${issues.length} criticità aperte` +
      (kpi.nScontrini ? `, incasso oggi €${kpi.totale.toFixed(2)}` : ", nessun scontrino oggi."),
    azioni: issues[0]?.azioni?.slice(0, 2),
  };
}

let loopOn = false;
export function startIaLoop() {
  if (loopOn || typeof window === "undefined") return;
  loopOn = true;
  try {
    if ("Notification" in window && Notification.permission === "default") {
      void Notification.requestPermission();
    }
  } catch {}
  setTimeout(() => void runIaCheck(), 2500);
  setTimeout(() => void checkFrigoSlot(), 4000);
  setTimeout(() => void checkReportSera(), 5000);
  setInterval(() => void runIaCheck(), 300000);
  setInterval(() => void checkFrigoSlot(), 60000);
  setInterval(() => void checkReportSera(), 60000);
}
