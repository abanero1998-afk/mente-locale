"use client";

import { useEffect, useRef, useState } from "react";
import { useMenteStore, wireSync } from "@/lib/store";
import { useLocaleStore } from "@/lib/locale-store";
import { canFullApp, useAuth } from "@/lib/auth";
import { useCassa, type Pagamento, type SplitParte } from "@/lib/cassa";
import { kpiOggi, orariPunta, topProdotti } from "@/lib/dashboard-stats";
import { apriStampa, ticketHtml } from "@/lib/ticket";
import {
  buildVenditeCsv,
  downloadCsv,
  filterScontriniPeriodo,
  stampaReportPeriodo,
  type Periodo,
} from "@/lib/report-export";
import { SEZIONI_MENU, type Piatto, type Reparto, type RigaComanda, type Tavolo } from "@/lib/types";
import { MenuTab, ProductThumb } from "./menu-tab";
import { HaccpTab } from "./haccp-tab";
import { CassaTab } from "./cassa-tab";
import { LoginScreen } from "./login-screen";
import { SettingsPanel } from "./settings-panel";
import { SyncHeaderBadge } from "./sync-panel"; /* pay+sync+reports §5-7 */
import { playUi } from "@/lib/sounds";
import { emitScontrinoFiscale, getFiscalBundle, isFiscalRequired, useFiscal } from "@/lib/fiscal";
import type { FiscalPagamento } from "@/lib/fiscal";

type Tab = "dashboard" | "tavoli" | "menu" | "haccp" | "cassa";
const MENU_FALLBACK: Piatto[] = [
  { id: "1", nome: "Carbonara", prezzo: 16, reparto: "cucina", categoria: "Primi", img: "https://images.unsplash.com/photo-1612874742237-6526221588e3?w=400&h=300&fit=crop" },
  { id: "2", nome: "Cacio e Pepe", prezzo: 15, reparto: "cucina", categoria: "Primi", img: "https://images.unsplash.com/photo-1621996346565-e3dbc646d9a9?w=400&h=300&fit=crop" },
  { id: "3", nome: "Tagliata di manzo", prezzo: 28, reparto: "cucina", categoria: "Secondi", img: "https://images.unsplash.com/photo-1600891964092-4316c288032e?w=400&h=300&fit=crop" },
  { id: "4", nome: "Patate al forno", prezzo: 6, reparto: "cucina", categoria: "Contorni", img: "https://images.unsplash.com/photo-1518013431117-eb1465fa5752?w=400&h=300&fit=crop" },
  { id: "5", nome: "Tiramisù", prezzo: 8, reparto: "cucina", categoria: "Dolci", img: "https://images.unsplash.com/photo-1571877227200-a0d98ea607e9?w=400&h=300&fit=crop" },
  { id: "6", nome: "Spritz", prezzo: 9, reparto: "bar", categoria: "Bevande", img: "https://images.unsplash.com/photo-1551024709-8f23befc6f87?w=400&h=300&fit=crop" },
  { id: "7", nome: "Chianti Classico", prezzo: 28, reparto: "bar", categoria: "Vini", img: "https://images.unsplash.com/photo-1510812431401-41d2bd2722f3?w=400&h=300&fit=crop" },
];
const NAV: { id: Tab; label: string; icon: string }[] = [
  { id: "dashboard", label: "Dashboard", icon: "grid" },
  { id: "tavoli", label: "Tavoli", icon: "table" },
  { id: "menu", label: "Menu", icon: "menu" },
  { id: "haccp", label: "HACCP", icon: "shield" },
  { id: "cassa", label: "Cassa", icon: "brain" },
];

function oraNow() {
  return new Date().toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" });
}

function sezioneDi(item: { piatto?: Piatto; categoria?: string }): string {
  const cat = (item.piatto?.categoria || item.categoria || "").trim();
  if ((SEZIONI_MENU as readonly string[]).includes(cat)) return cat;
  return "Altro";
}

function groupBySezione<T extends { piatto?: Piatto; categoria?: string }>(items: T[]): { sezione: string; items: T[] }[] {
  const buckets: Record<string, T[]> = {};
  for (const it of items) {
    const key = sezioneDi(it);
    if (!buckets[key]) buckets[key] = [];
    buckets[key].push(it);
  }
  const ordered: { sezione: string; items: T[] }[] = [];
  for (const s of SEZIONI_MENU) {
    if (buckets[s]?.length) ordered.push({ sezione: s, items: buckets[s] });
  }
  if (buckets["Altro"]?.length) ordered.push({ sezione: "Altro", items: buckets["Altro"] });
  return ordered;
}

function stampaComanda(tavolo: string, righe: RigaComanda[], locale: string) {
  const cucina = righe.filter((r) => r.piatto.reparto === "cucina");
  const bar = righe.filter((r) => r.piatto.reparto === "bar");
  if (cucina.length)
    apriStampa(
      ticketHtml({
        tipo: "COMANDA CUCINA",
        tavolo,
        ora: oraNow(),
        locale,
        righe: cucina.map((r) => ({ nome: r.piatto.nome, qta: r.qta, nota: r.nota })),
      })
    );
  if (bar.length)
    setTimeout(
      () =>
        apriStampa(
          ticketHtml({
            tipo: "COMANDA BAR",
            tavolo,
            ora: oraNow(),
            locale,
            righe: bar.map((r) => ({ nome: r.piatto.nome, qta: r.qta, nota: r.nota })),
          })
        ),
      400
    );
  void fetch("/api/ticket", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ tipo: "comanda", tavolo }) });
}

function Icon({ name, active }: { name: string; active?: boolean }) {
  const stroke = active ? "#FF2A2A" : "rgba(255,255,255,0.86)";
  const common = { width: 22, height: 22, viewBox: "0 0 24 24", fill: "none" as const, stroke, strokeWidth: 1.6, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  if (name === "grid") return (<svg {...common}><rect x="3" y="3" width="7" height="7" rx="1.4" /><rect x="14" y="3" width="7" height="7" rx="1.4" /><rect x="3" y="14" width="7" height="7" rx="1.4" /><rect x="14" y="14" width="7" height="7" rx="1.4" /></svg>);
  if (name === "table") return (<svg {...common}><path d="M4 10h16M8 10v8M16 10v8" /></svg>);
  if (name === "menu") return (<svg {...common}><path d="M4 7h16M4 12h16M4 17h10" /></svg>);
  if (name === "shield") return (<svg {...common}><path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6l8-3z" /></svg>);
  return (<svg {...common}><rect x="3" y="6" width="18" height="12" rx="2" /><path d="M7 10h4" /></svg>);
}

function KdsOnly({ reparto }: { reparto: Reparto }) {
  const tavoli = useMenteStore((s) => s.tavoli);
  const kds = tavoli.flatMap((t) => t.ordini.map((o) => ({ ...o, tavolo: t.nome }))).filter((o) => o.piatto.reparto === reparto && o.stato !== "pronto");
  return (
    <div className="min-h-screen bg-[#050507] text-white p-4">
      <div className="flex justify-between mb-4">
        <h1 className="font-black">KDS {reparto.toUpperCase()}</h1>
        <button onClick={() => useAuth.getState().logout()} className="text-[10px] text-white/40">ESCI</button>
      </div>
      {kds.length === 0 && <p className="text-white/40">Nessun piatto in coda.</p>}
      {kds.map((o) => (
        <div key={o.id} className="rounded-2xl glass p-4 mb-2">
          <p className="font-black">{o.tavolo} · {o.piatto.nome} x{o.qta}</p>
          {o.note ? <p className="text-xs italic text-white/55 mt-1">{o.note}</p> : null}
          <button onClick={() => { playUi("success"); void useMenteStore.getState().setOrdineStato(o.id, "pronto"); }} className="text-[10px] mt-2 px-3 py-1 rounded-full bg-emerald-400 text-black font-black">PRONTO</button>
        </div>
      ))}
    </div>
  );
}

export default function App() {
  const sessione = useAuth((s) => s.sessione);
  const sale = useLocaleStore((s) => s.sale);
  const [tab, setTab] = useState<Tab>("tavoli");
  const tavoli = useMenteStore((s) => s.tavoli);
  const menu = useMenteStore((s) => s.menu);
  const online = useMenteStore((s) => s.online);
  const scontriniCassa = useCassa((s) => s.scontrini);
  const [salaId, setSalaId] = useState("sala-int");
  const [editMap, setEditMap] = useState(false);
  const [selezionato, setSelezionato] = useState<Tavolo | null>(null);
  const [comanda, setComanda] = useState<RigaComanda[]>([]);
  const [pay, setPay] = useState<Pagamento>("contanti");
  const [scontoMode, setScontoMode] = useState<"euro" | "pct">("euro");
  const [scontoVal, setScontoVal] = useState("0");
  const [mancia, setMancia] = useState("0");
  const [manciaCustom, setManciaCustom] = useState(false);
  const [splitMode, setSplitMode] = useState<"none" | "equal" | "custom">("none");
  const [splitN, setSplitN] = useState(2);
  const [splitCustom, setSplitCustom] = useState<SplitParte[]>([
    { label: "Parte 1", importo: 0, pagamento: "contanti" },
    { label: "Parte 2", importo: 0, pagamento: "carta" },
  ]);
  const [mistoContanti, setMistoContanti] = useState("");
  const [mistoCarta, setMistoCarta] = useState("");
  const [posRef, setPosRef] = useState("");
  const [noteSc, setNoteSc] = useState("");
  const [payMsg, setPayMsg] = useState("");
  const [fiscalBusy, setFiscalBusy] = useState(false);
  const fiscalDemo = useFiscal((s) => s.demoNonFiscale);
  const setFiscalDemo = useFiscal((s) => s.setDemoNonFiscale);
  const [dashPeriodo, setDashPeriodo] = useState<Periodo>("oggi");
  const [showKds, setShowKds] = useState(false);
  const [kdsFiltro, setKdsFiltro] = useState<Reparto>("cucina");
  const swOnce = useRef(false);
  const menuLive = menu.length ? menu : MENU_FALLBACK;
  const visibili = tavoli.filter((t) => (t.salaId || "sala-int") === salaId);
  const tutti = tavoli.flatMap((t) => t.ordini.map((o) => ({ ...o, tavolo: t.nome })));
  const kds = tutti.filter((o) => o.piatto.reparto === kdsFiltro && o.stato !== "pronto");
  const menuSezioni = groupBySezione(menuLive.map((p) => ({ ...p, piatto: p })));
  const comandaSezioni = groupBySezione(comanda);

  useEffect(() => {
    if (swOnce.current) return;
    swOnce.current = true;
    if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js", { updateViaCache: "none" }).catch(() => {});
    wireSync();
  }, []);

  useEffect(() => {
    if (!sessione?.localeId) return;
    void import("@/lib/tenant-runtime").then((m) => m.activateLocale(sessione.localeId));
  }, [sessione?.localeId]);

  useEffect(() => {
    if (!selezionato) return;
    const live = tavoli.find((t) => t.id === selezionato.id);
    if (live) setSelezionato(live);
  }, [tavoli, selezionato?.id]);

  /** Navigazione da chip IA Socio (bolla / mini-chat). */
  useEffect(() => {
    const onNav = (ev: Event) => {
      const detail = (ev as CustomEvent<{ kind?: string }>).detail || {};
      const kind = detail.kind || "";
      if (kind === "cassa") setTab("cassa");
      else if (kind === "menu") setTab("menu");
      else if (kind === "haccp" || kind === "magazzino") setTab("haccp");
      else if (kind === "tavolo" || kind === "prenotazioni") setTab("tavoli");
      else if (kind === "kds") {
        setShowKds(true);
        setTab("tavoli");
      }
    };
    window.addEventListener("ml-ia-nav", onNav as EventListener);
    return () => window.removeEventListener("ml-ia-nav", onNav as EventListener);
  }, []);

  if (!sessione) return <LoginScreen />;
  if (sessione.ruolo === "cucina") return <KdsOnly reparto="cucina" />;
  if (sessione.ruolo === "bar") return <KdsOnly reparto="bar" />;
  if (!canFullApp(sessione.ruolo)) return <LoginScreen />;

  const addPiatto = (p: Piatto) => {
    setComanda((rows) => {
      const f = rows.find((r) => r.piatto.id === p.id);
      return f
        ? rows.map((r) => (r.piatto.id === p.id ? { ...r, qta: r.qta + 1 } : r))
        : [...rows, { id: `c-${Date.now()}-${p.id}`, piatto: p, qta: 1, nota: "" }];
    });
  };

  const setQta = (id: string, delta: number) => {
    setComanda((rows) =>
      rows
        .map((r) => (r.id === id ? { ...r, qta: r.qta + delta } : r))
        .filter((r) => r.qta > 0)
    );
  };

  const setNota = (id: string, nota: string) => {
    setComanda((rows) => rows.map((r) => (r.id === id ? { ...r, nota } : r)));
  };

  const inviaComanda = async () => {
    if (!selezionato || !comanda.length) return;
    for (const r of comanda) await useMenteStore.getState().aggiungiOrdine(selezionato.id, r.piatto, r.qta, r.nota);
    setComanda([]);
  };

  const calcPay = () => {
    if (!selezionato) {
      return { righe: [] as { nome: string; qta: number; prezzo: number; note?: string }[], subtotale: 0, sconto: 0, scontoPct: 0, manciaN: 0, totale: 0 };
    }
    const righe = selezionato.ordini.map((o) => ({
      nome: o.piatto.nome,
      qta: o.qta,
      prezzo: o.piatto.prezzo,
      note: o.note,
    }));
    const subtotale = righe.reduce((s, r) => s + r.prezzo * r.qta, 0);
    const raw = Number(scontoVal) || 0;
    let sconto = 0;
    let scontoPct = 0;
    if (scontoMode === "pct") {
      scontoPct = Math.min(100, Math.max(0, raw));
      sconto = (subtotale * scontoPct) / 100;
    } else {
      sconto = Math.min(subtotale, Math.max(0, raw));
      scontoPct = subtotale > 0 ? (sconto / subtotale) * 100 : 0;
    }
    const after = Math.max(0, subtotale - sconto);
    const manciaN = Math.max(0, Number(mancia) || 0);
    const totale = after + manciaN;
    return { righe, subtotale, sconto, scontoPct, manciaN, totale };
  };

  const buildSplitLines = (totale: number): SplitParte[] | undefined => {
    if (splitMode === "none") return undefined;
    if (splitMode === "equal") {
      const n = Math.max(2, Math.min(12, splitN || 2));
      const each = Math.round((totale / n) * 100) / 100;
      const parts: SplitParte[] = [];
      let acc = 0;
      for (let i = 0; i < n; i++) {
        const importo = i === n - 1 ? Math.round((totale - acc) * 100) / 100 : each;
        acc += importo;
        parts.push({ label: `Parte ${i + 1}`, importo, pagamento: pay });
      }
      return parts;
    }
    return splitCustom.slice(0, Math.max(2, Math.min(4, splitCustom.length)));
  };

  const ticketOpts = (
    tipo: "PRECONTO" | "SCONTRINO",
    fiscalExtra?: { fiscale?: boolean; partitaIva?: string; ragioneSociale?: string; indirizzoFiscale?: string; rtProtocollo?: string }
  ) => {
    const { righe, subtotale, sconto, manciaN, totale } = calcPay();
    const split = buildSplitLines(totale);
    return {
      tipo,
      tavolo: selezionato!.nome,
      ora: oraNow(),
      locale: sessione.localeNome,
      operatore: sessione.staffNome,
      righe: righe.map((r) => ({ nome: r.nome, qta: r.qta, prezzo: r.prezzo, nota: r.note })),
      subtotale,
      sconto,
      mancia: manciaN,
      totale,
      pagamento: pay,
      splitLines: split?.map((s) => ({ label: s.label, importo: s.importo, pagamento: s.pagamento })),
      riferimentoPos: posRef.trim() || undefined,
      noteFiscali: noteSc.trim() || undefined,
      ...(fiscalExtra || {}),
    };
  };

  const resetPayUi = () => {
    setPay("contanti");
    setScontoVal("0");
    setScontoMode("euro");
    setMancia("0");
    setManciaCustom(false);
    setSplitMode("none");
    setSplitN(2);
    setMistoContanti("");
    setMistoCarta("");
    setPosRef("");
    setNoteSc("");
    setPayMsg("");
  };

  const preconto = () => {
    if (!selezionato) return;
    apriStampa(ticketHtml(ticketOpts("PRECONTO")));
  };

  const stampaCopia = () => {
    if (!selezionato) return;
    apriStampa(ticketHtml(ticketOpts("SCONTRINO")));
  };

  const paga = async () => {
    if (!selezionato || fiscalBusy) return;
    const { righe, subtotale, sconto, scontoPct, manciaN, totale } = calcPay();
    if (pay === "misto") {
      const c = Number(mistoContanti) || 0;
      const k = Number(mistoCarta) || 0;
      if (Math.abs(c + k - totale) > 0.02) {
        setPayMsg(`Misto: contanti+carta devono sommare ${totale.toFixed(2)} (ora ${(c + k).toFixed(2)})`);
        return;
      }
    }
    const split = buildSplitLines(totale);
    if (splitMode === "custom" && split) {
      const sum = split.reduce((a, x) => a + x.importo, 0);
      if (Math.abs(sum - totale) > 0.05) {
        setPayMsg(`Split: somma parti ${sum.toFixed(2)} ≠ totale ${totale.toFixed(2)}`);
        return;
      }
    }

    const bundle = getFiscalBundle();
    const needFiscal = isFiscalRequired(bundle);
    let fiscale = false;
    let rtProtocollo: string | undefined;
    let partitaIva: string | undefined;
    let ragioneSociale: string | undefined;
    let indirizzoFiscale: string | undefined;

    if (needFiscal) {
      setFiscalBusy(true);
      setPayMsg("Invio scontrino al Registratore Telematico…");
      const pagamenti: FiscalPagamento[] =
        pay === "misto"
          ? [
              { tipo: "contanti", importo: Number(mistoContanti) || 0 },
              { tipo: "carta", importo: Number(mistoCarta) || 0 },
            ]
          : [{ tipo: pay, importo: totale }];
      const fiscalRes = await emitScontrinoFiscale({
        righe: righe.map((r) => ({
          nome: r.nome,
          qta: r.qta,
          prezzo: r.prezzo,
          aliquota: bundle.profilo.aliquotaDefault,
          note: r.note,
        })),
        pagamenti,
        profilo: bundle.profilo,
        rt: bundle.rt,
        operatore: sessione.staffNome,
      });
      setFiscalBusy(false);
      if (!fiscalRes.ok) {
        setPayMsg(
          `Chiusura bloccata: scontrino fiscale non emesso. ${fiscalRes.error || "RT non raggiungibile"}. Attiva "modalità demo non fiscale" (solo titolare) solo per test.`
        );
        return;
      }
      fiscale = true;
      rtProtocollo = fiscalRes.protocollo;
      partitaIva = bundle.profilo.partitaIva;
      ragioneSociale = bundle.profilo.ragioneSociale;
      const addr = [bundle.profilo.indirizzo, bundle.profilo.cap, bundle.profilo.citta, bundle.profilo.provincia]
        .filter(Boolean)
        .join(", ");
      indirizzoFiscale = addr || undefined;
      setPayMsg("");
    }

    useCassa.getState().emetti({
      tavolo: selezionato.nome,
      tavoloId: selezionato.id,
      righe,
      coperti: selezionato.clienti || selezionato.posti || 2,
      subtotale,
      sconto,
      scontoPct,
      mancia: manciaN,
      totale,
      pagamento: pay,
      mistoDettaglio: pay === "misto" ? { contanti: Number(mistoContanti) || 0, carta: Number(mistoCarta) || 0 } : undefined,
      splitParti: split?.length,
      splitDettaglio: split,
      operatore: sessione.staffNome,
      riferimentoPos: posRef.trim() || undefined,
      noteFiscali: noteSc.trim() || undefined,
      fiscale,
      rtProtocollo,
      partitaIva,
      ragioneSociale,
    });
    apriStampa(
      ticketHtml(
        ticketOpts("SCONTRINO", {
          fiscale,
          partitaIva,
          ragioneSociale,
          indirizzoFiscale,
          rtProtocollo,
        })
      )
    );
    void useMenteStore.getState().chiudiTavolo(selezionato.id);
    setSelezionato(null);
    setComanda([]);
    resetPayUi();
  };

  const top = topProdotti(scontriniCassa, 8);
  const ore = orariPunta(scontriniCassa);
  const kpi = kpiOggi(scontriniCassa);
  const maxOre = ore.reduce((m, o) => (o.count > m ? o.count : m), 0) || 1;
  const maxTop = top.reduce((m, t) => (t.qta > m ? t.qta : m), 0) || 1;

  return (
    <div className="min-h-screen bg-[#050507] text-white relative overflow-hidden select-none">
      <style>{`.glass{backdrop-filter:blur(40px);background:rgba(255,255,255,.03);border:.5px solid rgba(255,26,26,.08)}.glass-strong{backdrop-filter:blur(60px);background:rgba(0,0,0,.62);border:.5px solid rgba(255,26,26,.12)}.nav-pill{background:linear-gradient(180deg,rgba(255,255,255,.1),rgba(8,8,8,.55));border:1px solid rgba(255,70,70,.28)}`}</style>
      <header className="relative z-20 p-4 flex justify-between items-center glass">
        <div>
          <p className="font-black text-[12px] tracking-[0.2em]">{sessione.localeNome.toUpperCase()}</p>
          <p className="text-[9px] text-white/30">{online ? "LIVE" : "OFFLINE"} · {sessione.staffNome}</p>
        </div>
        <div className="flex gap-2 items-center">
          <SyncHeaderBadge />
          {sessione.ruolo === "titolare" && (
            <button onClick={() => useAuth.getState().cambiaLocale()} className="text-[9px] text-white/40">CAMBIA LOCALE</button>
          )}
          <button onClick={() => useAuth.getState().logout()} className="text-[9px] text-white/40">ESCI</button>
          <button onClick={() => setShowKds(true)} className="px-3 py-2 rounded-full bg-[#FF1A1A] text-black text-[10px] font-black">KDS</button>
        </div>
      </header>
      <main className="relative z-10 p-4 pb-32 max-w-[920px] mx-auto">
        {tab === "tavoli" && (
          <div>
            <div className="flex gap-2 overflow-x-auto pb-2">
              {sale.map((s) => (
                <button key={s.id} onClick={() => setSalaId(s.id)} className={`px-3 py-1 rounded-full text-[10px] font-black ${salaId === s.id ? "bg-[#FF1A1A] text-black" : "glass"}`}>{s.nome}</button>
              ))}
              <button onClick={() => setEditMap((v) => !v)} className="px-3 py-1 rounded-full text-[10px] glass">{editMap ? "OK" : "MODIFICA"}</button>
            </div>
            {editMap && (
              <button onClick={() => useLocaleStore.getState().addTavolo(salaId)} className="w-full mb-2 py-2 rounded-full bg-white text-black text-[10px] font-black">+ TAVOLO</button>
            )}
            <div className="relative w-full h-[58vh] min-h-[360px] rounded-[32px] glass-strong overflow-hidden">
              {visibili.map((t) => (
                <button
                  key={t.id}
                  onClick={() => { if (editMap) useLocaleStore.getState().deleteTavolo(t.id); else { setSelezionato(t); setComanda([]); } }}
                  style={{ left: `${t.x}%`, top: `${t.y}%` }}
                  className={`absolute -translate-x-1/2 -translate-y-1/2 w-[68px] h-[68px] rounded-full glass flex items-center justify-center ${
                    t.stato === "occupato" || t.stato === "conto"
                      ? "ring-2 ring-[#FF1A1A] border border-[#FF1A1A]"
                      : t.stato === "prenotato"
                        ? "ring-2 ring-amber-400/70 border border-amber-400/50"
                        : ""
                  }`}
                >
                  <span className="text-[11px] font-black">{t.nome}</span>
                </button>
              ))}
            </div>
          </div>
        )}
        {tab === "dashboard" && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => setTab("cassa")} className="rounded-2xl glass p-3 text-left">
                <p className="text-[9px] text-white/40">CASSA</p>
                <p className="text-xl font-black">apri</p>
              </button>
              <button onClick={() => setTab("haccp")} className="rounded-2xl glass p-3 text-left">
                <p className="text-[9px] text-white/40">HACCP</p>
                <p className="text-xl font-black">registro</p>
              </button>
            </div>

            {kpi.nScontrini > 0 && (
              <div className="grid grid-cols-3 gap-2">
                <div className="rounded-2xl glass p-3">
                  <p className="text-[9px] text-white/40">TOTALE OGGI</p>
                  <p className="text-lg font-black">€{kpi.totale.toFixed(2)}</p>
                </div>
                <div className="rounded-2xl glass p-3">
                  <p className="text-[9px] text-white/40">SCONTRINI</p>
                  <p className="text-lg font-black">{kpi.nScontrini}</p>
                </div>
                <div className="rounded-2xl glass p-3">
                  <p className="text-[9px] text-white/40">COPERTI</p>
                  <p className="text-lg font-black">{kpi.coperti}</p>
                </div>
              </div>
            )}

            <div className="rounded-[24px] glass p-4">
              <p className="text-[10px] tracking-widest text-white/45 font-black mb-3">PRODOTTI PIÙ VENDUTI</p>
              {top.length === 0 ? (
                <p className="text-sm text-white/45">Nessuna vendita ancora — chiudi un tavolo con PAGA E CHIUDI</p>
              ) : (
                <div className="space-y-2">
                  {top.map((row) => (
                    <div key={row.nome} className="flex items-center gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between gap-2 mb-1">
                          <p className="text-sm font-bold truncate">{row.nome}</p>
                          <p className="text-[11px] font-black text-[#FF1A1A]">×{row.qta}</p>
                        </div>
                        <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
                          <div className="h-full rounded-full bg-[#FF1A1A]" style={{ width: `${Math.max(8, (row.qta / maxTop) * 100)}%` }} />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="rounded-[24px] glass p-4">
              <p className="text-[10px] tracking-widest text-white/45 font-black mb-3">ORARI DI PUNTA</p>
              {ore.length === 0 ? (
                <p className="text-sm text-white/45">Nessun orario ancora — i dati arrivano dagli scontrini chiusi in cassa.</p>
              ) : (
                <div className="space-y-2">
                  {ore.map((o) => (
                    <div key={o.ora} className="flex items-center gap-3">
                      <p className="w-12 text-[11px] font-black text-white/70">{o.label}</p>
                      <div className="flex-1">
                        <div className="h-2 rounded-full bg-white/10 overflow-hidden">
                          <div className="h-full rounded-full bg-white/70" style={{ width: `${Math.max(6, (o.count / maxOre) * 100)}%` }} />
                        </div>
                      </div>
                      <p className="text-[10px] text-white/50 w-[88px] text-right">{o.count} · €{o.totale.toFixed(0)}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="rounded-[24px] glass-strong p-4 space-y-3">
              <p className="text-[10px] tracking-widest text-white/45 font-black">REPORT / EXPORT</p>
              <div className="flex flex-wrap gap-1.5">
                {([["oggi", "Oggi"], ["7gg", "7 gg"], ["30gg", "30 gg"]] as [Periodo, string][]).map(([id, lab]) => (
                  <button key={id} onClick={() => setDashPeriodo(id)} className={`px-3 py-1 rounded-full text-[10px] font-black ${dashPeriodo === id ? "bg-[#FF1A1A] text-black" : "glass"}`}>{lab}</button>
                ))}
              </div>
              <button
                onClick={() => {
                  const rows = filterScontriniPeriodo(scontriniCassa, dashPeriodo);
                  if (!rows.length) { alert("Nessuna vendita nel periodo"); return; }
                  downloadCsv(`vendite-${dashPeriodo}.csv`, buildVenditeCsv(rows));
                }}
                className="w-full py-3 rounded-full bg-white text-black font-black text-sm"
              >CSV VENDITE</button>
              <button
                onClick={() => {
                  const rows = filterScontriniPeriodo(scontriniCassa, dashPeriodo);
                  if (!rows.length) { alert("Nessun dato per il report"); return; }
                  const lab = dashPeriodo === "oggi" ? "Oggi" : dashPeriodo === "7gg" ? "7 giorni" : "30 giorni";
                  stampaReportPeriodo(rows, lab);
                }}
                className="w-full py-3 rounded-full glass font-black text-sm"
              >REPORT STAMPABILE</button>
              <button onClick={() => setTab("cassa")} className="w-full py-2 text-[10px] text-white/40">Apri Cassa → Export chiusure / ASL</button>
            </div>

            {sessione.ruolo === "titolare" && <SettingsPanel />}
          </div>
        )}
        {tab === "menu" && <MenuTab onAdd={() => {}} />}
        {tab === "haccp" && <HaccpTab />}
        {tab === "cassa" && <CassaTab />}
      </main>
      {showKds && (
        <div className="fixed inset-0 z-50 bg-black/80 p-4 flex items-end">
          <div className="w-full rounded-[28px] glass-strong p-5">
            <div className="flex justify-between"><h2 className="font-black">KDS</h2><button onClick={() => setShowKds(false)}>✕</button></div>
            <div className="flex gap-2 mt-3">{(["cucina", "bar"] as Reparto[]).map((r) => (<button key={r} onClick={() => { playUi("tap"); setKdsFiltro(r); }} className={`text-[10px] px-3 py-1 rounded-full ${kdsFiltro === r ? "bg-[#FF1A1A] text-black font-black" : "glass"}`}>{r.toUpperCase()}</button>))}</div>
            {kds.map((o) => (
              <div key={o.id} className="glass rounded-2xl p-3 mt-2">
                <p className="font-black">{o.tavolo} {o.piatto.nome}</p>
                {o.note ? <p className="text-xs italic text-white/55 mt-1">{o.note}</p> : null}
                <button onClick={() => { playUi("success"); void useMenteStore.getState().setOrdineStato(o.id, "pronto"); }} className="text-[10px] mt-2 px-3 py-1 rounded-full bg-emerald-400 text-black font-black">PRONTO</button>
              </div>
            ))}
          </div>
        </div>
      )}
      {selezionato && (
        <div className="fixed inset-0 z-50 flex items-end bg-black/70 p-3">
          <div className="w-full max-w-[560px] mx-auto rounded-[28px] glass-strong p-5 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between"><h2 className="font-black">{selezionato.nome}</h2><button onClick={() => setSelezionato(null)}>✕</button></div>
            <div className="mt-4 space-y-4">
              {menuSezioni.map(({ sezione, items }) => (
                <div key={sezione}>
                  <p className="text-[10px] tracking-widest text-white/45 font-black mb-2">{sezione.toUpperCase()}</p>
                  <div className="grid grid-cols-2 gap-2">
                    {items.map((p) => (
                      <button key={p.id} onClick={() => addPiatto(p)} className="text-left p-2.5 rounded-2xl glass flex items-center gap-2">
                        <ProductThumb src={p.img} alt={p.nome} size={40} />
                        <div className="min-w-0">
                          <p className="text-sm font-bold truncate">{p.nome}</p>
                          <p className="text-[10px] text-white/40">€{p.prezzo} · {p.categoria}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            {comanda.length > 0 && (
              <div className="mt-4 space-y-3">
                <p className="text-[10px] tracking-widest text-white/45 font-black">BOZZA COMANDA</p>
                {comandaSezioni.map(({ sezione, items }) => (
                  <div key={`c-${sezione}`} className="space-y-2">
                    <p className="text-[9px] text-white/35 font-bold">{sezione}</p>
                    {items.map((r) => (
                      <div key={r.id} className="rounded-2xl glass p-3">
                        <div className="flex items-center gap-2">
                          <button onClick={() => setQta(r.id, -1)} className="w-8 h-8 rounded-full bg-white/10 font-black">-</button>
                          <span className="w-6 text-center font-black">{r.qta}</span>
                          <button onClick={() => setQta(r.id, 1)} className="w-8 h-8 rounded-full bg-white/10 font-black">+</button>
                          <p className="flex-1 text-sm font-bold truncate">{r.piatto.nome}</p>
                        </div>
                        <input
                          value={r.nota || ""}
                          onChange={(e) => setNota(r.id, e.target.value)}
                          placeholder="nota cucina: senza cipolla, al sangue…"
                          className="mt-2 w-full rounded-xl bg-black/40 border border-white/10 px-3 py-2 text-xs text-white placeholder:text-white/30 outline-none"
                        />
                      </div>
                    ))}
                  </div>
                ))}
                <button onClick={() => { playUi("success"); void inviaComanda(); }} className="w-full py-3 rounded-full bg-white text-black font-black">INVIA A KDS</button>
              </div>
            )}
            {selezionato.ordini.length > 0 && (() => {
              const { subtotale, sconto, manciaN, totale } = calcPay();
              const afterDisc = Math.max(0, subtotale - sconto);
              const equalEach = splitMode === "equal" ? totale / Math.max(2, splitN) : 0;
              return (
              <div className="mt-3 space-y-3">
                <p className="text-[10px] tracking-widest text-white/45 font-black">ORDINE TAVOLO</p>
                {selezionato.ordini.map((o) => (
                  <div key={o.id}>
                    <p className="text-sm text-white/60">{o.piatto.nome} x{o.qta} · €{(o.piatto.prezzo * o.qta).toFixed(2)}</p>
                    {o.note ? <p className="text-xs italic text-white/40">{o.note}</p> : null}
                  </div>
                ))}

                <div className="rounded-2xl glass p-3 space-y-2">
                  <div className="flex justify-between text-sm"><span className="text-white/50">Subtotale</span><span className="font-black">€{subtotale.toFixed(2)}</span></div>
                  <div className="flex gap-2 items-center">
                    <span className="text-[10px] text-white/40 w-14">Sconto</span>
                    <button onClick={() => setScontoMode("euro")} className={`px-2 py-1 rounded-full text-[9px] font-black ${scontoMode === "euro" ? "bg-[#FF1A1A] text-black" : "glass"}`}>€</button>
                    <button onClick={() => setScontoMode("pct")} className={`px-2 py-1 rounded-full text-[9px] font-black ${scontoMode === "pct" ? "bg-[#FF1A1A] text-black" : "glass"}`}>%</button>
                    <input type="number" value={scontoVal} onChange={(e) => setScontoVal(e.target.value)} className="flex-1 p-2 rounded-xl bg-black/40 text-sm" />
                  </div>
                  {sconto > 0 && <p className="text-[10px] text-white/40">−€{sconto.toFixed(2)}</p>}

                  <div>
                    <p className="text-[10px] text-white/40 mb-1">Mancia €</p>
                    <div className="flex flex-wrap gap-1.5">
                      {[
                        { lab: "0", val: "0" },
                        { lab: "5%", val: String(Math.round(afterDisc * 0.05 * 100) / 100) },
                        { lab: "10%", val: String(Math.round(afterDisc * 0.1 * 100) / 100) },
                        { lab: "Custom", val: "__custom__" },
                      ].map((c) => (
                        <button
                          key={c.lab}
                          onClick={() => {
                            if (c.val === "__custom__") { setManciaCustom(true); return; }
                            setManciaCustom(false);
                            setMancia(c.val);
                          }}
                          className={`px-3 py-1.5 rounded-full text-[9px] font-black ${(!manciaCustom && mancia === c.val) || (c.val === "__custom__" && manciaCustom) ? "bg-[#FF1A1A] text-black" : "glass"}`}
                        >{c.lab}</button>
                      ))}
                    </div>
                    {manciaCustom && (
                      <input type="number" value={mancia} onChange={(e) => setMancia(e.target.value)} className="w-full mt-2 p-2 rounded-xl bg-black/40 text-sm" placeholder="Importo mancia" />
                    )}
                  </div>

                  <div className="flex justify-between text-base pt-1 border-t border-white/10">
                    <span className="font-black">Totale finale</span>
                    <span className="font-black text-[#FF1A1A]">€{totale.toFixed(2)}</span>
                  </div>
                  {manciaN > 0 && <p className="text-[10px] text-emerald-300">di cui mancia €{manciaN.toFixed(2)}</p>}
                </div>

                <div className="rounded-2xl glass p-3 space-y-2">
                  <p className="text-[10px] text-white/40 font-black">SPLIT CONTO</p>
                  <div className="flex gap-1.5">
                    {([["none", "No"], ["equal", "Uguale"], ["custom", "Custom"]] as const).map(([id, lab]) => (
                      <button key={id} onClick={() => setSplitMode(id)} className={`flex-1 py-2 rounded-full text-[9px] font-black ${splitMode === id ? "bg-[#FF1A1A] text-black" : "glass"}`}>{lab}</button>
                    ))}
                  </div>
                  {splitMode === "equal" && (
                    <div className="space-y-1">
                      <label className="text-[9px] text-white/40">N parti / coperti</label>
                      <input type="number" min={2} max={12} value={splitN} onChange={(e) => setSplitN(Math.max(2, Number(e.target.value) || 2))} className="w-full p-2 rounded-xl bg-black/40 text-sm" />
                      <p className="text-[11px] text-white/50">≈ €{equalEach.toFixed(2)} a testa</p>
                    </div>
                  )}
                  {splitMode === "custom" && (
                    <div className="space-y-2">
                      {splitCustom.map((sp, idx) => (
                        <div key={idx} className="grid grid-cols-[1fr_80px_90px] gap-1">
                          <input value={sp.label} onChange={(e) => setSplitCustom((rows) => rows.map((r, i) => i === idx ? { ...r, label: e.target.value } : r))} className="p-2 rounded-xl bg-black/40 text-xs" />
                          <input type="number" value={sp.importo || ""} onChange={(e) => setSplitCustom((rows) => rows.map((r, i) => i === idx ? { ...r, importo: Number(e.target.value) || 0 } : r))} className="p-2 rounded-xl bg-black/40 text-xs" placeholder="€" />
                          <select value={sp.pagamento} onChange={(e) => setSplitCustom((rows) => rows.map((r, i) => i === idx ? { ...r, pagamento: e.target.value as Pagamento } : r))} className="p-2 rounded-xl bg-black/40 text-[10px]">
                            {(["contanti", "carta", "satispay", "misto"] as Pagamento[]).map((p) => <option key={p} value={p}>{p}</option>)}
                          </select>
                        </div>
                      ))}
                      <div className="flex gap-2">
                        <button
                          disabled={splitCustom.length >= 4}
                          onClick={() => setSplitCustom((rows) => rows.length >= 4 ? rows : [...rows, { label: `Parte ${rows.length + 1}`, importo: 0, pagamento: "contanti" }])}
                          className="flex-1 py-2 rounded-full glass text-[9px] font-black disabled:opacity-30"
                        >+ PARTE</button>
                        <button
                          disabled={splitCustom.length <= 2}
                          onClick={() => setSplitCustom((rows) => rows.length <= 2 ? rows : rows.slice(0, -1))}
                          className="flex-1 py-2 rounded-full glass text-[9px] font-black disabled:opacity-30"
                        >− PARTE</button>
                      </div>
                    </div>
                  )}
                </div>

                <div>
                  <p className="text-[10px] text-white/40 mb-1">Pagamento</p>
                  <div className="grid grid-cols-4 gap-1.5">
                    {(["contanti", "carta", "satispay", "misto"] as Pagamento[]).map((p) => (
                      <button key={p} onClick={() => setPay(p)} className={`py-2 rounded-full text-[9px] font-black ${pay === p ? "bg-[#FF1A1A] text-black" : "glass"}`}>{p}</button>
                    ))}
                  </div>
                  {pay === "misto" && (
                    <div className="grid grid-cols-2 gap-2 mt-2">
                      <div>
                        <label className="text-[9px] text-white/40">Contanti €</label>
                        <input type="number" value={mistoContanti} onChange={(e) => setMistoContanti(e.target.value)} className="w-full p-2 rounded-xl bg-black/40 text-sm" />
                      </div>
                      <div>
                        <label className="text-[9px] text-white/40">Carta €</label>
                        <input type="number" value={mistoCarta} onChange={(e) => setMistoCarta(e.target.value)} className="w-full p-2 rounded-xl bg-black/40 text-sm" />
                      </div>
                    </div>
                  )}
                </div>

                <div>
                  <label className="text-[9px] text-white/40">Codice autorizzazione POS (opz.)</label>
                  <input value={posRef} onChange={(e) => setPosRef(e.target.value)} className="w-full mt-1 p-2 rounded-xl bg-black/40 text-sm" placeholder="Es. AUTH-48291" />
                </div>
                <div>
                  <label className="text-[9px] text-white/40">Note scontrino</label>
                  <input value={noteSc} onChange={(e) => setNoteSc(e.target.value)} className="w-full mt-1 p-2 rounded-xl bg-black/40 text-sm" placeholder="Note fiscali / cliente" />
                </div>

                {payMsg && <p className="text-[11px] text-amber-300">{payMsg}</p>}

                {sessione.ruolo === "titolare" && (
                  <div className="rounded-2xl border border-amber-500/50 bg-amber-500/10 p-3 space-y-2">
                    <p className="text-[11px] font-black text-amber-200">⚠ Modalità demo non fiscale</p>
                    <p className="text-[10px] text-amber-100/80">
                      Con profilo completo e RT abilitato, senza RT raggiungibile la chiusura è bloccata.
                      Solo il titolare può attivare la demo (ticket non fiscale). Default produzione: fiscale obbligatorio.
                    </p>
                    <label className="flex items-center gap-2 text-[11px] text-amber-100">
                      <input
                        type="checkbox"
                        checked={fiscalDemo}
                        onChange={(e) => {
                          setFiscalDemo(e.target.checked);
                          useFiscal.getState().syncToTenant();
                        }}
                      />
                      Consenti chiusura in modalità demo non fiscale
                    </label>
                  </div>
                )}
                {isFiscalRequired(getFiscalBundle()) && (
                  <p className="text-[10px] text-white/40">Chiusura fiscale obbligatoria (RT). Preconto resta non fiscale.</p>
                )}

                <button onClick={preconto} className="w-full py-3 rounded-full glass font-black text-sm">PRECONTO</button>
                <button
                  disabled={fiscalBusy}
                  onClick={() => { playUi("success"); void paga(); }}
                  className="w-full py-3 rounded-full bg-[#FF1A1A] text-black font-black disabled:opacity-50"
                >{fiscalBusy ? "FISCALE…" : "PAGA E CHIUDI"}</button>
                <button onClick={stampaCopia} className="w-full py-3 rounded-full glass font-black text-sm">STAMPA COPIA</button>
              </div>
              );
            })()}
          </div>
        </div>
      )}
      <nav className="fixed bottom-4 left-3 right-3 max-w-[760px] mx-auto z-40">
        <div className="rounded-full nav-pill px-3 py-3 flex justify-between">
          {NAV.map((n) => (
            <button key={n.id} onClick={() => { playUi("nav"); setTab(n.id); }} className="flex flex-col items-center min-w-[48px]">
              <Icon name={n.icon} active={tab === n.id} />
              <span className={`text-[8px] mt-1 ${tab === n.id ? "text-[#FF2A2A]" : "text-white/45"}`}>{n.label}</span>
            </button>
          ))}
        </div>
      </nav>
    </div>
  );
}
