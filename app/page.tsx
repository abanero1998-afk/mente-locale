"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useMenteStore, wireSync } from "@/lib/store";
import type { Piatto, Reparto, StatoOrdine, Tavolo } from "@/lib/types";
import { MenuTab, ProdottoRow } from "./menu-tab";

type Tab =
  | "dashboard"
  | "tavoli"
  | "prenotazioni"
  | "menu"
  | "magazzino"
  | "haccp"
  | "kds"
  | "ia";

const MENU_FALLBACK: Piatto[] = [
  { id: "1", nome: "Carbonara", prezzo: 16, reparto: "cucina", categoria: "Primi", img: "🍝" },
];

const NAV: { id: Tab; label: string; icon: string }[] = [
  { id: "dashboard", label: "Dashboard", icon: "grid" },
  { id: "tavoli", label: "Tavoli", icon: "table" },
  { id: "prenotazioni", label: "Prenotazioni", icon: "cal" },
  { id: "menu", label: "Menu", icon: "chart" },
  { id: "magazzino", label: "Magazzino", icon: "box" },
  { id: "haccp", label: "HACCP", icon: "shield" },
  { id: "kds", label: "KDS", icon: "screen" },
  { id: "ia", label: "IA", icon: "brain" },
];

function playFile(src: string, fallbackHz = 800) {
  const audio = new Audio(src);
  audio.volume = 0.55;
  audio.play().catch(() => {
    try {
      const ctx = new AudioContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.frequency.value = fallbackHz;
      gain.gain.value = 0.08;
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.18);
    } catch {}
  });
}

async function notifyKds(piatto: Piatto, tavoloNome: string) {
  const title = `KDS ${piatto.reparto.toUpperCase()}`;
  const body = `${piatto.nome} → ${tavoloNome}`;
  playFile(piatto.reparto === "bar" ? "/sounds/ding-pronto.wav" : "/sounds/beep-nuovo.wav", piatto.reparto === "bar" ? 980 : 800);
  try {
    if (!("Notification" in window)) return;
    if (Notification.permission === "default") await Notification.requestPermission();
    if (Notification.permission !== "granted") return;
    const reg = await navigator.serviceWorker?.ready;
    if (reg) reg.active?.postMessage({ type: "NOTIFY", title, body, tag: `kds-${piatto.reparto}`, url: "/?tab=kds" });
    else new Notification(title, { body, icon: "/logo-mark.jpg", tag: `kds-${piatto.reparto}` });
  } catch {}
}

function Icon({ name, active }: { name: string; active?: boolean }) {
  const stroke = active ? "#FF2A2A" : "rgba(255,255,255,0.86)";
  const common = { width: 22, height: 22, viewBox: "0 0 24 24", fill: "none" as const, stroke, strokeWidth: 1.6, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  if (name === "grid") return (<svg {...common}><rect x="3" y="3" width="7" height="7" rx="1.4" /><rect x="14" y="3" width="7" height="7" rx="1.4" /><rect x="3" y="14" width="7" height="7" rx="1.4" /><rect x="14" y="14" width="7" height="7" rx="1.4" /></svg>);
  if (name === "table") return (<svg {...common}><path d="M4 10h16" /><path d="M8 10v8" /><path d="M16 10v8" /><circle cx="8" cy="7" r="2" /><circle cx="16" cy="7" r="2" /><path d="M6 18h4M14 18h4" /></svg>);
  if (name === "cal") return (<svg {...common}><rect x="4" y="5" width="16" height="15" rx="2" /><path d="M8 3v4M16 3v4M4 10h16" /><path d="M9 15l2 2 4-4" /></svg>);
  if (name === "chart") return (<svg {...common}><path d="M4 6h16M4 12h16M4 18h10" /></svg>);
  if (name === "box") return (<svg {...common}><path d="M12 3l8 4.5v9L12 21l-8-4.5v-9L12 3z" /><path d="M12 12l8-4.5M12 12v9M12 12L4 7.5" /></svg>);
  if (name === "shield") return (<svg {...common}><path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6l8-3z" /><path d="M9 12l2 2 4-4" /></svg>);
  if (name === "screen") return (<svg {...common}><rect x="3" y="5" width="18" height="12" rx="2" /><path d="M8 21h8M12 17v4" /></svg>);
  return (<svg {...common}><path d="M12 3c2 3 2 5 2 6a4 4 0 11-8 0c0-1 0-3 2-6 1 3 3 3 4 0z" /><path d="M8.5 16c.6 2 1.8 3.5 3.5 4.5 1.7-1 2.9-2.5 3.5-4.5" /></svg>);
}

export default function App() {
  const [tab, setTab] = useState<Tab>("tavoli");
  const tavoli = useMenteStore((s) => s.tavoli);
  const menu = useMenteStore((s) => s.menu);
  const magazzino = useMenteStore((s) => s.magazzino);
  const frighi = useMenteStore((s) => s.frighi);
  const prenotazioni = useMenteStore((s) => s.prenotazioni);
  const scontrini = useMenteStore((s) => s.scontrini);
  const online = useMenteStore((s) => s.online);
  const codaOffline = useMenteStore((s) => s.codaOffline);
  const [selezionato, setSelezionato] = useState<Tavolo | null>(null);
  const [kdsFiltro, setKdsFiltro] = useState<Reparto>("cucina");
  const [prodotto, setProdotto] = useState("Mozzarella fiordilatte");
  const [lotto, setLotto] = useState("L12345");
  const [dataApertura, setDataApertura] = useState("2026-09-01");
  const [iaOk, setIaOk] = useState(false);
  const [installEvt, setInstallEvt] = useState<any>(null);
  const [notifOn, setNotifOn] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ nome: "", prezzo: "", categoria: "Primi", reparto: "cucina" as Reparto, img: "🍝" });
  const swOnce = useRef(false);
  const occupati = tavoli.filter((t) => t.stato !== "libero").length;
  const tuttiOrdini = tavoli.flatMap((t) => t.ordini.map((o) => ({ ...o, tavolo: t.nome, tavoloId: t.id })));
  const kds = tuttiOrdini.filter((o) => o.piatto.reparto === kdsFiltro && o.stato !== "pronto");
  const ricaviAperti = tavoli.reduce((s, t) => s + t.ordini.reduce((a, o) => a + o.piatto.prezzo * o.qta, 0), 0);
  const ricaviOggi = scontrini.reduce((s, x) => s + x.totale, 0) + ricaviAperti;
  const tempoMedio = scontrini.length ? Math.round(scontrini.reduce((s, x) => s + x.minuti, 0) / scontrini.length) : 45;
  const critici = magazzino.filter((m) => m.qta < m.soglia);
  const frighiFuori = frighi.filter((f) => f.temp < f.min || f.temp > f.max);
  const prenOggi = prenotazioni.filter((p) => p.stato !== "cancellata");
  const prenWa = prenotazioni.filter((p) => p.fonte === "whatsapp" && p.stato === "da_confermare");
  const menuLive = menu.length ? menu : MENU_FALLBACK;

  useEffect(() => {
    if (swOnce.current) return;
    swOnce.current = true;
    if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(() => {});
    const onPrompt = (e: Event) => { e.preventDefault(); setInstallEvt(e); };
    window.addEventListener("beforeinstallprompt", onPrompt);
    if ("Notification" in window) setNotifOn(Notification.permission === "granted");
    wireSync();
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  useEffect(() => {
    if (!selezionato) return;
    const live = tavoli.find((t) => t.id === selezionato.id);
    if (live) setSelezionato(live);
  }, [tavoli, selezionato?.id]);

  const labelPreview = useMemo(() => {
    const open = new Date(dataApertura);
    const scad = new Date(open);
    scad.setDate(scad.getDate() + 3);
    const fmt = (d: Date) => (Number.isNaN(d.getTime()) ? "--" : d.toLocaleDateString("it-IT"));
    return { open: fmt(open), scad: fmt(scad) };
  }, [dataApertura]);

  const aggiungiOrdine = (tavoloId: number, piatto: Piatto) => {
    const tav = tavoli.find((t) => t.id === tavoloId);
    void useMenteStore.getState().aggiungiOrdine(tavoloId, piatto);
    void notifyKds(piatto, tav?.nome || `T${String(tavoloId).padStart(2, "0")}`);
  };

  return (
    <div className="min-h-screen bg-[#050507] text-white relative overflow-hidden select-none">
      <style>{`
        @keyframes pulse-red { 0%{box-shadow:0 0 0 0 rgba(255,26,26,.7)} 100%{box-shadow:0 0 0 0 rgba(255,26,26,0)} }
        .carbon-bg{background-color:#070707;background-image:url('/textures/carbon_texture.jpg'),repeating-linear-gradient(0deg,rgba(255,255,255,.035) 0 1px,transparent 1px 4px);background-size:280px,4px 4px}
        .glass{backdrop-filter:blur(40px);background:rgba(255,255,255,.03);border:.5px solid rgba(255,26,26,.08)}
        .glass-strong{backdrop-filter:blur(60px);background:rgba(0,0,0,.62);border:.5px solid rgba(255,26,26,.12)}
        .nav-pill{background:linear-gradient(180deg,rgba(255,255,255,.1),rgba(8,8,8,.55));border:1px solid rgba(255,70,70,.28)}
      `}</style>
      <div className="absolute inset-0 carbon-bg opacity-50" />
      <header className="relative z-20 p-5 flex justify-between border-b border-[#FF1A1A]/10 glass">
        <div className="flex items-center gap-3">
          <img src="/logo-mark.jpg" alt="Mente Locale" className="w-12 h-12 rounded-2xl object-cover border border-[#FF1A1A]/30" />
          <div>
            <p className="font-black text-[13px] tracking-[0.25em]">MENTE LOCALE</p>
            <p className="text-[9px] text-white/30 tracking-widest">CARBON EDITION • 20 TAVOLI</p>
          </div>
        </div>
        <div className="text-[10px] text-white/40">{online ? "LIVE" : "OFFLINE"}{codaOffline.length ? ` • CODA ${codaOffline.length}` : ""} • {occupati}/20</div>
      </header>
      <main className="relative z-10 p-4 pb-32 max-w-[920px] mx-auto">
        {tab === "tavoli" && (
          <div className="relative w-full h-[68vh] min-h-[420px] rounded-[32px] glass-strong overflow-hidden">
            {tavoli.map((t) => (
              <button key={t.id} onClick={() => setSelezionato(t)} style={{ left: `${t.x}%`, top: `${t.y}%` }} className={`absolute -translate-x-1/2 -translate-y-1/2 w-[72px] h-[72px] rounded-full glass flex flex-col items-center justify-center ${t.stato === "occupato" ? "border-[#00D9FF]/30" : t.stato === "prenotato" ? "border-amber-400/30" : "border-emerald-400/15"}`}>
                <span className="text-[11px] font-black">{t.nome}</span>
                {t.ordini.length > 0 && <span className="absolute -top-1 -right-1 w-5 h-5 bg-[#FF1A1A] text-black text-[10px] font-black rounded-full">{t.ordini.length}</span>}
              </button>
            ))}
          </div>
        )}
        {tab === "dashboard" && (
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-2">
              <button onClick={() => setTab("tavoli")} className="rounded-2xl glass p-3 text-left"><p className="text-[9px] text-white/40">OCCUPAZIONE</p><p className="text-2xl font-black text-[#00D9FF]">{Math.round((occupati / 20) * 100)}%</p><p className="text-[10px] text-white/50">{occupati}/20 LIVE</p></button>
              <div className="rounded-2xl glass p-3"><p className="text-[9px] text-white/40">RICAVI</p><p className="text-2xl font-black text-[#FF6B6B]">€{ricaviOggi}</p></div>
              <div className="rounded-2xl glass p-3"><p className="text-[9px] text-white/40">TEMPO MEDIO</p><p className="text-2xl font-black">{tempoMedio}min</p></div>
              <button onClick={() => setTab("magazzino")} className="rounded-2xl glass p-3 text-left"><p className="text-[9px] text-white/40">MAGAZZINO</p><p className="text-2xl font-black text-[#FF1A1A]">{critici.length}</p></button>
              <button onClick={() => setTab("haccp")} className="rounded-2xl glass p-3 text-left"><p className="text-[9px] text-white/40">HACCP</p><p className="text-2xl font-black text-[#FF1A1A]">{frighiFuori.length}</p></button>
              <button onClick={() => setTab("prenotazioni")} className={`rounded-2xl glass p-3 text-left ${prenWa.length ? "animate-[pulse-red_1.4s_ease-out_infinite]" : ""}`}><p className="text-[9px] text-white/40">PRENOTAZIONI</p><p className="text-2xl font-black">{prenOggi.length}</p><p className="text-[10px] text-[#FF6B6B]">{prenWa.length} WA da confermare</p></button>
            </div>
            <div className="rounded-[28px] glass-strong p-5 space-y-3">
              <h2 className="font-black">ANALISI SERATA</h2>
              <p className="text-sm text-white/60">Coperti stimati {occupati * 3} · ticket medio €{scontrini.length ? Math.round(ricaviOggi / Math.max(scontrini.length, 1)) : 29} · top Carbonara.</p>
            </div>
          </div>
        )}
        {tab === "menu" && <MenuTab onAdd={() => setShowAdd(true)} />}
        {tab === "prenotazioni" && (
          <div className="space-y-3">
            <h2 className="font-black tracking-widest text-sm">PRENOTAZIONI</h2>
            {prenotazioni.map((p) => (
              <div key={p.id} className="rounded-2xl glass p-4 flex justify-between items-center">
                <div><p className="font-bold">{p.nome}</p><p className="text-xs text-white/40">{p.persone} p • {p.tavolo} • {p.quando}</p></div>
                {p.stato === "da_confermare" ? <button onClick={() => useMenteStore.getState().confermaPrenotazione(p.id)} className="text-[10px] px-3 py-1 rounded-full bg-[#FF1A1A] text-black font-black">CONFERMA WA</button> : <span className="text-[10px] text-white/40">{p.stato}</span>}
              </div>
            ))}
          </div>
        )}
        {tab === "magazzino" && magazzino.map((m) => (
          <div key={m.id} className="glass rounded-2xl p-4 flex justify-between mb-2"><div><p className="font-semibold">{m.nome}</p><p className="text-xs text-white/40">{m.qta} {m.unita}</p></div><span className={m.qta < m.soglia ? "text-[#FF6B6B] text-[10px]" : "text-emerald-400 text-[10px]"}>{m.qta < m.soglia ? "sotto scorta" : "ok"}</span></div>
        ))}
        {tab === "haccp" && (
          <div className="rounded-[28px] glass-strong p-5">
            <h2 className="font-black mb-3">HACCP PRO</h2>
            <div className="grid grid-cols-2 gap-2 mb-4">{frighi.map((f) => { const fuori = f.temp > f.max || f.temp < f.min; return (<div key={f.id} className="rounded-2xl glass p-3"><p className="text-[10px] text-white/40">{f.nome}</p><p className={`text-xl font-black ${fuori ? "text-[#FF1A1A]" : "text-emerald-400"}`}>{f.temp.toFixed(1)}°C</p></div>); })}</div>
            <input value={prodotto} onChange={(e) => setProdotto(e.target.value)} className="bg-black/40 border border-white/10 rounded-xl p-3 w-full mb-2" />
            <input value={lotto} onChange={(e) => setLotto(e.target.value)} className="bg-black/40 border border-white/10 rounded-xl p-3 w-full mb-2" />
            <div className="p-3 bg-white text-black rounded-xl text-[10px] font-mono"><p className="uppercase font-bold">{prodotto}</p><p>Aperto: {labelPreview.open} - Scad: {labelPreview.scad}</p><p>Lotto: {lotto}</p></div>
          </div>
        )}
        {tab === "kds" && (
          <div className="space-y-3">
            <div className="flex gap-2">{(["cucina", "bar"] as Reparto[]).map((r) => (<button key={r} onClick={() => setKdsFiltro(r)} className={`text-[10px] px-3 py-1 rounded-full ${kdsFiltro === r ? "bg-[#FF1A1A] text-black font-black" : "glass"}`}>{r.toUpperCase()}</button>))}</div>
            {kds.map((o) => (
              <div key={o.id} className="rounded-2xl glass p-4">
                <p className="font-black">{o.tavolo} · {o.piatto.nome} x{o.qta}</p>
                <button onClick={() => void useMenteStore.getState().setOrdineStato(o.id, "pronto")} className="text-[10px] mt-2 px-3 py-1 rounded-full bg-emerald-400 text-black font-black">PRONTO</button>
              </div>
            ))}
          </div>
        )}
        {tab === "ia" && (
          <div className="rounded-[28px] glass-strong p-5">
            <h2 className="font-black">IA SOCIO</h2>
            <p className="text-sm text-white/70 mt-3">{iaOk ? "Ordine inviato a Rossi." : "Sergio, servono 4kg di mozzarella. Ordino da Rossi?"}</p>
            {!iaOk && <button onClick={() => setIaOk(true)} className="text-xs bg-white text-black px-4 py-2 rounded-full font-black mt-4">Sì, ordina</button>}
          </div>
        )}
      </main>
      {showAdd && (
        <div className="fixed inset-0 z-50 glass-strong p-6 flex items-end justify-center">
          <div className="w-full max-w-md space-y-3">
            <div className="flex justify-between"><h3 className="font-black">NUOVO PRODOTTO</h3><button onClick={() => setShowAdd(false)}>✕</button></div>
            <input placeholder="Nome es Carbonara" value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} className="w-full p-4 rounded-2xl bg-white/5 border border-[#FF1A1A]/10" />
            <input placeholder="Prezzo 16" type="number" value={form.prezzo} onChange={(e) => setForm({ ...form, prezzo: e.target.value })} className="w-full p-4 rounded-2xl bg-white/5 border border-[#FF1A1A]/10" />
            <button onClick={() => { void useMenteStore.getState().aggiungiProdotto(form); setShowAdd(false); setForm({ nome: "", prezzo: "", categoria: "Primi", reparto: "cucina", img: "🍝" }); }} className="w-full py-4 bg-[#FF1A1A] text-black rounded-full font-black">SALVA • VA SUBITO IN TUTTI I TELEFONI</button>
          </div>
        </div>
      )}
      {selezionato && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-3">
          <div className="w-full max-w-[560px] rounded-[28px] glass-strong p-5">
            <div className="flex justify-between"><h2 className="font-black">{selezionato.nome}</h2><button onClick={() => setSelezionato(null)}>✕</button></div>
            <div className="grid grid-cols-2 gap-2 mt-4">{menuLive.map((p) => (<button key={p.id} onClick={() => aggiungiOrdine(selezionato.id, p)} className="text-left p-3 rounded-2xl glass"><p className="text-sm font-bold">{p.img} {p.nome}</p></button>))}</div>
            <button onClick={() => { void useMenteStore.getState().chiudiTavolo(selezionato.id); setSelezionato(null); }} className="w-full mt-4 py-3 rounded-full bg-[#FF1A1A] text-black font-black">CHIUDI</button>
          </div>
        </div>
      )}
      <nav className="fixed bottom-4 left-3 right-3 max-w-[760px] mx-auto z-40">
        <div className="rounded-full nav-pill px-3 py-3 flex justify-between items-end">
          {NAV.map((n) => {
            const active = tab === n.id;
            return (
              <button key={n.id} onClick={() => setTab(n.id)} className="flex flex-col items-center min-w-[36px]">
                <Icon name={n.icon} active={active} />
                <span className={`text-[8px] mt-1 ${active ? "text-[#FF2A2A]" : "text-white/45"}`}>{n.label}</span>
                {active && <div className="w-1 h-1 bg-[#FF1A1A] rounded-full mt-1" />}
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
