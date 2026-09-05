"use client";

import { useMenteStore } from "./store";
import { deviceId, publishLocal, publishRemote, supabaseConfigured } from "./sync";

const WA_TO = process.env.NEXT_PUBLIC_SOCIO_WA || "+3444106229";
const SLOT_HOURS = [17, 19, 21, 23];
const KDS_STALE_MS = 20 * 60 * 1000;
const PULIZIA_STALE_MS = 12 * 60 * 60 * 1000;

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

export async function avvisaSocio(msg: string) {
  const urgente = msg.includes("🚨") || msg.includes("TEMP FRIGO");
  useMenteStore.getState().pushAvviso(msg, urgente);
  playIaSound(urgente);
  void notifyPush(msg);
  const ev = { kind: "avviso_socio" as const, msg, urgente, deviceId };
  publishLocal(ev);
  if (supabaseConfigured()) await publishRemote(ev);
  if (urgente) {
    try {
      await fetch("/api/whatsapp/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to: WA_TO, msg }),
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
  if (diff < -30 * 60 * 1000) diff += 24 * 60 * 60 * 1000; // ieri sera
  if (diff < 0 || diff > 18 * 60 * 60 * 1000) return null;
  return diff;
}

export async function runIaCheck() {
  const { tavoli, magazzino, frighi, prenotazioni, pulizie } = useMenteStore.getState();
  const critici = magazzino.filter((m) => m.qta < m.soglia || m.qta < 5);
  const fuori = frighi.filter((f) => f.temp > f.max || f.temp < f.min);
  const lenti = tavoli.filter((t) => t.stato !== "libero" && t.tempo > 60);
  const daConfermare = prenotazioni.filter((p) => p.stato === "da_confermare");
  const puliziePending = pulizie.filter(
    (p) => !p.fatto || (p.ts > 0 && Date.now() - p.ts > PULIZIA_STALE_MS && !p.fatto)
  );
  const pulizieOverdue = pulizie.filter((p) => !p.fatto && Date.now() - p.ts > PULIZIA_STALE_MS);
  const conto = tavoli.filter((t) => t.stato === "conto");
  const kdsStale = tavoli.flatMap((t) =>
    t.ordini
      .filter((o) => o.stato === "ordinato" || o.stato === "in_prep")
      .map((o) => {
        const età = etàDaOra(o.ora);
        return età != null && età > KDS_STALE_MS ? { ...o, tavolo: t.nome, età } : null;
      })
      .filter(Boolean)
  );

  let alerted = false;
  if (critici.length) {
    await avvisaSocio(`⚠️ Sergio, stanno finendo: ${critici.map((m) => m.nome).join(", ")}. Ordino da Rossi?`);
    alerted = true;
  }
  if (fuori.length) {
    await avvisaSocio(`🚨 Frigo ${fuori[0].nome} a ${fuori[0].temp}°C! Chiama tecnico!`);
    alerted = true;
  }
  if (lenti.length) {
    await avvisaSocio(`⏱️ ${lenti[0].nome} occupato da ${lenti[0].tempo}min, sollecita?`);
    alerted = true;
  }
  if (daConfermare.length) {
    await avvisaSocio(
      `📅 Prenotazioni da confermare: ${daConfermare.map((p) => `${p.nome} (${p.quando})`).join(", ")}.`
    );
    alerted = true;
  }
  if (pulizieOverdue.length || puliziePending.filter((p) => !p.fatto).length) {
    const zone = (pulizieOverdue.length ? pulizieOverdue : pulizie.filter((p) => !p.fatto))
      .map((p) => p.zona)
      .slice(0, 4);
    await avvisaSocio(`🧹 Pulizie incomplete o in ritardo: ${zone.join(", ")}.`);
    alerted = true;
  }
  if (conto.length) {
    await avvisaSocio(`💳 Tavoli in conto da chiudere: ${conto.map((t) => t.nome).join(", ")}.`);
    alerted = true;
  }
  if (kdsStale.length) {
    const first = kdsStale[0] as { tavolo: string; piatto: { nome: string }; età: number };
    const min = Math.round(first.età / 60000);
    await avvisaSocio(
      `🍳 Ordine KDS fermo da ~${min} min: ${first.tavolo} · ${first.piatto.nome}${kdsStale.length > 1 ? ` (+${kdsStale.length - 1})` : ""}.`
    );
    alerted = true;
  }
  if (!alerted) {
    await avvisaSocio("✅ Tutto ok: magazzino, frighi, prenotazioni e tempi sotto controllo.");
  }
}

export async function checkFrigoSlot() {
  const now = new Date();
  const hour = now.getHours();
  const minute = now.getMinutes();
  if (!SLOT_HOURS.includes(hour) || minute > 8) return;
  const key = `${now.toDateString()}-${hour}`;
  if (typeof sessionStorage !== "undefined" && sessionStorage.getItem(`frigo-slot-${key}`)) return;
  sessionStorage.setItem(`frigo-slot-${key}`, "1");
  const { frighi } = useMenteStore.getState();
  const stale = frighi.filter((f) => !f.lastCheck || Date.now() - f.lastCheck > 110 * 60 * 1000);
  if (stale.length) {
    await avvisaSocio(`TEMP FRIGO ${hour}:00 — aggiorna temperature (${stale.map((f) => f.nome).join(", ")}). Apri HACCP e clicca AGGIORNATO.`);
  } else {
    await avvisaSocio(`TEMP FRIGO ${hour}:00 — slot di controllo. Conferma le temperature in HACCP.`);
  }
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
  setInterval(() => void runIaCheck(), 300000);
  setInterval(() => void checkFrigoSlot(), 60000);
}
