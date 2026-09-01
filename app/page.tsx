"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type Reparto = "cucina" | "bar";
type StatoTavolo = "libero" | "occupato" | "prenotato" | "conto";
type StatoOrdine = "ordinato" | "in_prep" | "pronto";
type Tab = "dashboard" | "tavoli" | "prenotazioni" | "analisi" | "magazzino" | "haccp" | "kds" | "ia";

type Piatto = { id: string; nome: string; prezzo: number; reparto: Reparto; categoria: string; img: string };
type Ordine = { id: string; piatto: Piatto; qta: number; note?: string; stato: StatoOrdine; ora: string };
type Tavolo = { id: number; nome: string; posti: number; stato: StatoTavolo; x: number; y: number; clienti: number; cameriere: string; ordini: Ordine[]; tempo: number; animazione?: "pulse" | "none" };

const MENU: Piatto[] = [
  { id: "1", nome: "Carbonara", prezzo: 16, reparto: "cucina", categoria: "Primi", img: "P" },
  { id: "2", nome: "Tagliata", prezzo: 28, reparto: "cucina", categoria: "Secondi", img: "S" },
  { id: "3", nome: "Negroni", prezzo: 10, reparto: "bar", categoria: "Cocktail", img: "B" },
  { id: "4", nome: "Tiramisu", prezzo: 8, reparto: "cucina", categoria: "Dolci", img: "D" },
  { id: "5", nome: "Spritz", prezzo: 9, reparto: "bar", categoria: "Cocktail", img: "B" },
  { id: "6", nome: "Cacio Pepe", prezzo: 15, reparto: "cucina", categoria: "Primi", img: "P" },
];

const PRENOTAZIONI = [
  { nome: "Mario Rossi", dettagli: "4 persone • T03 • Oggi 20:30", stato: "Confermata" },
  { nome: "Caterina Bianchi", dettagli: "2 persone • T01 • Oggi 21:00", stato: "VIP" },
  { nome: "Luca Verdi", dettagli: "6 persone • T08 • Oggi 19:00", stato: "Cancellata" },
  { nome: "Anna Neri", dettagli: "2 persone • T12 • Oggi 20:00", stato: "Confermata" },
];

const NAV: { id: Tab; label: string; icon: string }[] = [
  { id: "dashboard", label: "Dashboard", icon: "grid" },
  { id: "tavoli", label: "Tavoli", icon: "table" },
  { id: "prenotazioni", label: "Prenotazioni", icon: "cal" },
  { id: "analisi", label: "Analisi", icon: "chart" },
  { id: "magazzino", label: "Magazzino", icon: "box" },
  { id: "haccp", label: "HACCP", icon: "shield" },
  { id: "kds", label: "KDS", icon: "screen" },
  { id: "ia", label: "IA", icon: "brain" },
];

function makeTavoli(): Tavolo[] {
  const stati: StatoTavolo[] = ["libero", "libero", "occupato", "prenotato", "libero"];
  return Array.from({ length: 20 }, (_, i) => ({
    id: i + 1,
    nome: `T${String(i + 1).padStart(2, "0")}`,
    posti: [2, 2, 4, 4, 6, 8][i % 6],
    stato: stati[i % 5],
    x: 10 + (i % 5) * 18 + 5,
    y: 14 + Math.floor(i / 5) * 22,
    clienti: [2, 2, 4, 3, 5, 6][i % 6],
    cameriere: ["Luca", "Sara", "Marco"][i % 3],
    tempo: (i * 7) % 60,
    ordini: [],
    animazione: "none",
  }));
}

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
    if (reg?.active) {
      reg.active.postMessage({ type: "NOTIFY", title, body, tag: `kds-${piatto.reparto}`, url: "/?tab=kds" });
    } else {
      new Notification(title, { body, icon: "/icons/icon-192.jpg", tag: `kds-${piatto.reparto}` });
    }
  } catch {}
}

function Icon({ name, active }: { name: string; active?: boolean }) {
  const stroke = active ? "#FF2A2A" : "rgba(255,255,255,0.86)";
  const common = { width: 22, height: 22, viewBox: "0 0 24 24", fill: "none", stroke, strokeWidth: 1.6, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  if (name === "grid") return (<svg {...common}><rect x="3" y="3" width="7" height="7" rx="1.4" /><rect x="14" y="3" width="7" height="7" rx="1.4" /><rect x="3" y="14" width="7" height="7" rx="1.4" /><rect x="14" y="14" width="7" height="7" rx="1.4" /></svg>);
  if (name === "table") return (<svg {...common}><path d="M4 10h16" /><path d="M8 10v8" /><path d="M16 10v8" /><circle cx="8" cy="7" r="2" /><circle cx="16" cy="7" r="2" /><path d="M6 18h4M14 18h4" /></svg>);
  if (name === "cal") return (<svg {...common}><rect x="4" y="5" width="16" height="15" rx="2" /><path d="M8 3v4M16 3v4M4 10h16" /><path d="M9 15l2 2 4-4" /></svg>);
  if (name === "chart") return (<svg {...common}><path d="M5 19V10" /><path d="M10 19V6" /><path d="M15 19v-7" /><path d="M20 19V4" /></svg>);
  if (name === "box") return (<svg {...common}><path d="M12 3l8 4.5v9L12 21l-8-4.5v-9L12 3z" /><path d="M12 12l8-4.5M12 12v9M12 12L4 7.5" /></svg>);
  if (name === "shield") return (<svg {...common}><path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6l8-3z" /><path d="M9 12l2 2 4-4" /></svg>);
  if (name === "screen") return (<svg {...common}><rect x="3" y="5" width="18" height="12" rx="2" /><path d="M8 21h8M12 17v4" /></svg>);
  return (<svg {...common}><path d="M12 3c2 3 2 5 2 6a4 4 0 11-8 0c0-1 0-3 2-6 1 3 3 3 4 0z" /><path d="M8.5 16c.6 2 1.8 3.5 3.5 4.5 1.7-1 2.9-2.5 3.5-4.5" /><circle cx="18" cy="6" r="1" fill={stroke} /><circle cx="20" cy="9" r="0.8" fill={stroke} /></svg>);
}

export default function App() {
  const [tab, setTab] = useState<Tab>("tavoli");
  const [tavoli, setTavoli] = useState<Tavolo[]>(() => makeTavoli());
  const [selezionato, setSelezionato] = useState<Tavolo | null>(null);
  const [kdsFiltro, setKdsFiltro] = useState<Reparto>("cucina");
  const [prodotto, setProdotto] = useState("Mozzarella fiordilatte");
  const [lotto, setLotto] = useState("L12345");
  const [dataApertura, setDataApertura] = useState("2026-09-01");
  const [iaOk, setIaOk] = useState(false);
  const [installEvt, setInstallEvt] = useState<any>(null);
  const [notifOn, setNotifOn] = useState(false);
  const swOnce = useRef(false);

  useEffect(() => {
    if (swOnce.current) return;
    swOnce.current = true;
    if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(() => {});
    const onPrompt = (e: Event) => { e.preventDefault(); setInstallEvt(e); };
    window.addEventListener("beforeinstallprompt", onPrompt);
    if ("Notification" in window) setNotifOn(Notification.permission === "granted");
    const q = new URLSearchParams(window.location.search).get("tab") as Tab | null;
    if (q) setTab(q);
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  const occupati = tavoli.filter((t) => t.stato !== "libero").length;
  const tuttiOrdini = tavoli.flatMap((t) => t.ordini.map((o) => ({ ...o, tavolo: t.nome, tavoloId: t.id })));
  const kds = tuttiOrdini.filter((o) => o.piatto.reparto === kdsFiltro && o.stato !== "pronto");
  const ricavi = tavoli.reduce((s, t) => s + t.ordini.reduce((a, o) => a + o.piatto.prezzo * o.qta, 0), 0);

  const labelPreview = useMemo(() => {
    const open = new Date(dataApertura);
    const scad = new Date(open);
    scad.setDate(scad.getDate() + 3);
    const fmt = (d: Date) => (Number.isNaN(d.getTime()) ? "--" : d.toLocaleDateString("it-IT"));
    return { open: fmt(open), scad: fmt(scad) };
  }, [dataApertura]);

  const animaTavolo = (id: number) => {
    setTavoli((prev) => prev.map((t) => (t.id === id ? { ...t, animazione: "pulse" } : t)));
    setTimeout(() => setTavoli((prev) => prev.map((t) => (t.id === id ? { ...t, animazione: "none" } : t))), 2000);
  };

  const aggiungiOrdine = (tavoloId: number, piatto: Piatto) => {
    const nuovoOrdine: Ordine = { id: `${Date.now()}-${piatto.id}`, piatto, qta: 1, stato: "ordinato", ora: new Date().toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" }) };
    setTavoli((prev) => prev.map((t) => (t.id === tavoloId ? { ...t, ordini: [...t.ordini, nuovoOrdine], stato: "occupato" } : t)));
    setSelezionato((prev) => (prev?.id === tavoloId ? { ...prev, ordini: [...prev.ordini, nuovoOrdine], stato: "occupato" } : prev));
    animaTavolo(tavoloId);
    const tav = tavoli.find((t) => t.id === tavoloId);
    void notifyKds(piatto, tav?.nome || `T${String(tavoloId).padStart(2, "0")}`);
  };

  const setOrdineStato = (ordineId: string, stato: StatoOrdine) => {
    setTavoli((prev) => prev.map((t) => ({ ...t, ordini: t.ordini.map((o) => (o.id === ordineId ? { ...o, stato } : o)) })));
    if (stato === "pronto") playFile("/sounds/ding-pronto.wav", 980);
  };

  const chiudiTavolo = (id: number) => {
    setTavoli((prev) => prev.map((t) => (t.id === id ? { ...t, stato: "libero", ordini: [], animazione: "none" } : t)));
    setSelezionato(null);
  };

  return (
    <div className="min-h-screen bg-[#050507] text-white relative overflow-hidden select-none">
      <style>{`
        @keyframes pulse-red { 0%{box-shadow:0 0 0 0 rgba(255,26,26,0.7),0 0 30px rgba(255,26,26,0.3)} 50%{box-shadow:0 0 0 20px rgba(255,26,26,0),0 0 60px rgba(255,26,26,0.6)} 100%{box-shadow:0 0 0 0 rgba(255,26,26,0),0 0 30px rgba(255,26,26,0.3)} }
        @keyframes glow-cyan { 0%,100%{box-shadow:0 0 20px rgba(0,217,255,0.2),inset 0 1px 1px rgba(255,255,255,0.1)} 50%{box-shadow:0 0 40px rgba(0,217,255,0.4),inset 0 1px 1px rgba(255,255,255,0.15)} }
        .carbon-bg { background-color:#070707; background-image: repeating-linear-gradient(0deg, rgba(255,255,255,0.035) 0 1px, transparent 1px 4px), repeating-linear-gradient(90deg, rgba(255,255,255,0.035) 0 1px, transparent 1px 4px); background-size: 4px 4px, 4px 4px; }
        .glass { backdrop-filter: blur(40px); -webkit-backdrop-filter: blur(40px); background: rgba(255,255,255,0.03); border: 0.5px solid rgba(255,26,26,0.08); }
        .glass-strong { backdrop-filter: blur(60px); -webkit-backdrop-filter: blur(60px); background: rgba(0,0,0,0.62); border: 0.5px solid rgba(255,26,26,0.12); box-shadow: inset 0 1px 1px rgba(255,255,255,0.08), 0 20px 80px rgba(0,0,0,0.9); }
        .nav-pill { background: linear-gradient(180deg, rgba(255,255,255,0.10), rgba(8,8,8,0.55)); border: 1px solid rgba(255,70,70,0.28); box-shadow: 0 0 0 1px rgba(255,26,26,0.18), 0 0 24px rgba(255,26,26,0.16), inset 0 1px 0 rgba(255,255,255,0.22); }
      `}</style>
      <div className="absolute inset-0 carbon-bg opacity-50" />
      <header className="relative z-20 p-5 flex justify-between items-center border-b border-[#FF1A1A]/10 glass">
        <div className="flex items-center gap-3">
          <img src="/logo-mark.jpg" alt="Mente Locale" className="w-11 h-11 rounded-2xl object-cover border border-[#FF1A1A]/35 shadow-[0_0_16px_rgba(255,26,26,0.35)]" />
          <div>
            <p className="font-black text-[13px] tracking-[0.25em]">MENTE LOCALE</p>
            <p className="text-[9px] text-white/30 tracking-widest">CARBON EDITION • 20 TAVOLI</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {!notifOn && <button onClick={async () => { const p = await Notification.requestPermission(); setNotifOn(p === "granted"); }} className="text-[9px] tracking-widest px-3 py-1.5 rounded-full glass">ATTIVA PUSH</button>}
          {installEvt && <button onClick={async () => { installEvt.prompt(); await installEvt.userChoice; setInstallEvt(null); }} className="text-[9px] tracking-widest px-3 py-1.5 rounded-full bg-[#FF1A1A] text-black font-black">INSTALLA</button>}
          <div className="text-[10px] text-white/40">LIVE • {occupati}/20</div>
        </div>
      </header>
      <main className="relative z-10 p-4 pb-32 max-w-[920px] mx-auto">
        {tab === "tavoli" && (
          <>
            <div className="relative w-full h-[68vh] min-h-[420px] rounded-[32px] glass-strong overflow-hidden">
              {tavoli.map((t) => (
                <button key={t.id} onClick={() => setSelezionato(t)} style={{ left: `${t.x}%`, top: `${t.y}%` }} className={`absolute -translate-x-1/2 -translate-y-1/2 w-[72px] h-[72px] rounded-full flex flex-col items-center justify-center transition-all duration-500 glass ${t.stato === "libero" ? "border-emerald-400/15" : t.stato === "occupato" ? "border-[#00D9FF]/30" : t.stato === "prenotato" ? "border-amber-400/30" : "border-[#FF1A1A]/30"} ${t.animazione === "pulse" ? "animate-[pulse-red_1s_ease-out_2]" : t.stato === "occupato" ? "animate-[glow-cyan_3s_ease-in-out_infinite]" : ""}`}>
                  <span className="text-[11px] font-black">{t.nome}</span>
                  <span className="text-[7px] text-white/40">{t.posti}P • {t.clienti}CLI</span>
                  {t.ordini.length > 0 && <span className="absolute -top-1 -right-1 w-5 h-5 bg-[#FF1A1A] text-black text-[10px] font-black rounded-full flex items-center justify-center">{t.ordini.length}</span>}
                </button>
              ))}
            </div>
          </>
        )}
        {tab === "dashboard" && (
          <div className="rounded-[28px] glass-strong p-5 grid grid-cols-3 gap-3">
            <div><p className="text-[10px] text-white/40">OCCUPAZIONE</p><p className="text-4xl font-black text-[#00D9FF]">{Math.round((occupati / 20) * 100)}%</p></div>
            <div><p className="text-[10px] text-white/40">RICAVI LIVE</p><p className="text-4xl font-black text-[#FF6B6B]">EUR {ricavi}</p></div>
            <div><p className="text-[10px] text-white/40">KDS APERTI</p><p className="text-4xl font-black">{tuttiOrdini.filter((o) => o.stato !== "pronto").length}</p></div>
          </div>
        )}
        {tab === "prenotazioni" && (
          <div className="space-y-3">{PRENOTAZIONI.map((p) => (<div key={p.nome} className="rounded-2xl glass p-4 flex justify-between"><div><p className="font-bold">{p.nome}</p><p className="text-xs text-white/40">{p.dettagli}</p></div><span className="text-[10px]">{p.stato}</span></div>))}</div>
        )}
        {tab === "analisi" && (<div className="rounded-[28px] glass-strong p-5"><h2 className="font-black">ANALISI SERATA</h2><p className="text-sm text-white/60 mt-2">Coperti 42 • ticket medio 29,50</p></div>)}
        {tab === "magazzino" && (<div className="space-y-2">{[["Mozzarella","2.4 kg","sotto scorta"],["Guanciale","1.8 kg","ok"]].map(([n,q,s]) => (<div key={n} className="glass rounded-2xl p-4 flex justify-between"><span>{n} • {q}</span><span className="text-[10px]">{s}</span></div>))}</div>)}
        {tab === "haccp" && (
          <div className="rounded-[28px] glass-strong p-5">
            <h2 className="font-black mb-3">HACCP PRO</h2>
            <input value={prodotto} onChange={(e) => setProdotto(e.target.value)} className="bg-black/40 border border-white/10 rounded-xl p-3 w-full mb-2 text-xs" />
            <input value={lotto} onChange={(e) => setLotto(e.target.value)} className="bg-black/40 border border-white/10 rounded-xl p-3 w-full mb-2 text-xs" />
            <div className="mt-3 p-3 bg-white text-black rounded-xl text-[10px] font-mono"><p className="uppercase font-bold">{prodotto}</p><p>Aperto: {labelPreview.open} - Scad: {labelPreview.scad}</p><p>Lotto: {lotto}</p></div>
          </div>
        )}
        {tab === "kds" && (
          <div className="space-y-3">
            <div className="flex gap-2">{(["cucina","bar"] as Reparto[]).map((r) => (<button key={r} onClick={() => setKdsFiltro(r)} className={`text-[10px] px-3 py-1 rounded-full ${kdsFiltro === r ? "bg-[#FF1A1A] text-black font-black" : "glass text-white/50"}`}>{r.toUpperCase()}</button>))}</div>
            {kds.length === 0 && <p className="text-white/30 text-sm glass rounded-2xl p-6 text-center">Nessuna comanda in {kdsFiltro}.</p>}
            {kds.map((o) => (
              <div key={o.id} className="rounded-2xl glass p-4">
                <p className="font-black">{o.tavolo} · {o.piatto.nome} x{o.qta}</p>
                <div className="flex gap-2 mt-3">
                  <button onClick={() => setOrdineStato(o.id, "in_prep")} className="text-[10px] px-3 py-1 rounded-full bg-[#00D9FF] text-black font-black">IN PREP</button>
                  <button onClick={() => setOrdineStato(o.id, "pronto")} className="text-[10px] px-3 py-1 rounded-full bg-emerald-400 text-black font-black">PRONTO</button>
                </div>
              </div>
            ))}
          </div>
        )}
        {tab === "ia" && (
          <div className="rounded-[28px] glass-strong p-5">
            <h2 className="font-black">MENTE LOCALE IA</h2>
            <p className="text-sm text-white/70 mt-3">{iaOk ? "Ordine inviato a Rossi." : "Per sabato servono 4kg di mozzarella in piu."}</p>
            {!iaOk && <button onClick={() => setIaOk(true)} className="text-xs bg-white text-black px-4 py-2 rounded-full font-black mt-4">Si, ordina</button>}
          </div>
        )}
      </main>
      {selezionato && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-xl p-3">
          <div className="w-full max-w-[560px] rounded-[28px] glass-strong max-h-[88vh] flex flex-col overflow-hidden">
            <div className="p-5 flex justify-between border-b border-white/5">
              <div>
                <h2 className="text-xl font-black">{selezionato.nome} • {selezionato.clienti} persone • {selezionato.cameriere}</h2>
                <p className="text-xs text-white/40">Totale EUR {selezionato.ordini.reduce((s, o) => s + o.piatto.prezzo * o.qta, 0)}</p>
              </div>
              <button onClick={() => setSelezionato(null)} className="w-9 h-9 rounded-full glass">X</button>
            </div>
            <div className="p-5 space-y-4 overflow-y-auto flex-1">
              {selezionato.ordini.map((o) => (<div key={o.id} className="flex justify-between p-3 rounded-2xl glass"><span>{o.qta}x {o.piatto.nome} - {o.piatto.reparto.toUpperCase()}</span><span className="text-xs text-white/50">{o.stato}</span></div>))}
              <div className="grid grid-cols-2 gap-2">
                {MENU.map((p) => (
                  <button key={p.id} onClick={() => aggiungiOrdine(selezionato.id, p)} className="text-left p-3 rounded-2xl glass">
                    <p className="text-sm font-bold">{p.nome}</p>
                    <p className="text-[9px] text-white/40">{p.reparto.toUpperCase()} • EUR {p.prezzo}</p>
                  </button>
                ))}
              </div>
            </div>
            <div className="p-3 grid grid-cols-3 gap-2 border-t border-white/5">
              <button className="py-3 rounded-full glass text-xs">SPOSTA</button>
              <button className="py-3 rounded-full bg-[#00D9FF]/20 border border-[#00D9FF]/30 text-xs font-bold">CONTO DIVISO</button>
              <button onClick={() => chiudiTavolo(selezionato.id)} className="py-3 rounded-full bg-[#FF1A1A] text-black text-xs font-black">CHIUDI</button>
            </div>
          </div>
        </div>
      )}
      <nav className="fixed bottom-4 left-3 right-3 max-w-[760px] mx-auto z-40">
        <div className="rounded-full nav-pill px-3 sm:px-5 py-3 flex justify-between items-end">
          {NAV.map((n) => {
            const active = tab === n.id;
            return (
              <button key={n.id} onClick={() => setTab(n.id)} className="flex flex-col items-center min-w-[36px]">
                <Icon name={n.icon} active={active} />
                <span className={`text-[8px] mt-1 tracking-widest ${active ? "text-[#FF2A2A]" : "text-white/45"}`}>{n.label}</span>
                {active && <div className="w-1 h-1 bg-[#FF1A1A] rounded-full mt-1" />}
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
