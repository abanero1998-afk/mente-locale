"use client";

import { useEffect, useRef, useState } from "react";
import { useMenteStore, wireSync } from "@/lib/store";
import type { Piatto, Reparto, RigaComanda, Tavolo } from "@/lib/types";
import { MenuTab } from "./menu-tab";

type Tab = "dashboard" | "tavoli" | "menu" | "haccp" | "ia";

const MENU_FALLBACK: Piatto[] = [
  { id: "1", nome: "Carbonara", prezzo: 16, reparto: "cucina", categoria: "Primi", img: "🍝" },
];

const NAV: { id: Tab; label: string; icon: string }[] = [
  { id: "dashboard", label: "Dashboard", icon: "grid" },
  { id: "tavoli", label: "Tavoli", icon: "table" },
  { id: "menu", label: "Menu", icon: "menu" },
  { id: "haccp", label: "HACCP", icon: "shield" },
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
  if (name === "menu") return (<svg {...common}><path d="M4 7h16M4 12h16M4 17h10" /><circle cx="19" cy="17" r="2" /></svg>);
  if (name === "shield") return (<svg {...common}><path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6l8-3z" /><path d="M9 12l2 2 4-4" /></svg>);
  return (<svg {...common}><path d="M12 3c2 3 2 5 2 6a4 4 0 11-8 0c0-1 0-3 2-6 1 3 3 3 4 0z" /><path d="M8.5 16c.6 2 1.8 3.5 3.5 4.5 1.7-1 2.9-2.5 3.5-4.5" /></svg>);
}

function SwipeRiga({ children, onDelete }: { children: React.ReactNode; onDelete: () => void }) {
  const [open, setOpen] = useState(false);
  const startX = useRef(0);
  return (
    <div
      className="relative overflow-hidden rounded-2xl glass"
      onTouchStart={(e) => { startX.current = e.touches[0].clientX; }}
      onTouchEnd={(e) => {
        const dx = e.changedTouches[0].clientX - startX.current;
        if (dx < -48) setOpen(true);
        if (dx > 48) setOpen(false);
      }}
      onMouseDown={(e) => { startX.current = e.clientX; }}
      onMouseUp={(e) => {
        const dx = e.clientX - startX.current;
        if (dx < -48) setOpen(true);
        if (dx > 48) setOpen(false);
      }}
    >
      <div className={`transition-transform ${open ? "-translate-x-24" : ""}`}>{children}</div>
      {open && (
        <button onClick={onDelete} className="absolute inset-y-0 right-0 w-24 bg-[#FF1A1A] text-black font-black text-xs">ELIMINA</button>
      )}
    </div>
  );
}

export default function App() {
  const [tab, setTab] = useState<Tab>("tavoli");
  const tavoli = useMenteStore((s) => s.tavoli);
  const menu = useMenteStore((s) => s.menu);
  const magazzino = useMenteStore((s) => s.magazzino);
  const frighi = useMenteStore((s) => s.frighi);
  const lotti = useMenteStore((s) => s.lotti || []);
  const scontrini = useMenteStore((s) => s.scontrini);
  const logTemp = useMenteStore((s) => s.logTemp || []);
  const online = useMenteStore((s) => s.online);
  const codaOffline = useMenteStore((s) => s.codaOffline);
  const [selezionato, setSelezionato] = useState<Tavolo | null>(null);
  const [comanda, setComanda] = useState<RigaComanda[]>([]);
  const [showKds, setShowKds] = useState(false);
  const [kdsFiltro, setKdsFiltro] = useState<Reparto>("cucina");
  const [iaOk, setIaOk] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ nome: "", prezzo: "", categoria: "Primi", reparto: "cucina" as Reparto, img: "🍝" });
  const [lottoForm, setLottoForm] = useState({ prodotto: "Mozzarella", lotto: "L12345", scadenza: "2026-09-06" });
  const [tempDraft, setTempDraft] = useState<Record<string, string>>({});
  const [printMsg, setPrintMsg] = useState("");
  const swOnce = useRef(false);
  const occupati = tavoli.filter((t) => t.stato !== "libero").length;
  const tuttiOrdini = tavoli.flatMap((t) => t.ordini.map((o) => ({ ...o, tavolo: t.nome, tavoloId: t.id })));
  const kds = tuttiOrdini.filter((o) => o.piatto.reparto === kdsFiltro && o.stato !== "pronto");
  const kdsCount = tuttiOrdini.filter((o) => o.stato !== "pronto").length;
  const ricaviAperti = tavoli.reduce((s, t) => s + t.ordini.reduce((a, o) => a + o.piatto.prezzo * o.qta, 0), 0);
  const ricaviOggi = scontrini.reduce((s, x) => s + x.totale, 0) + ricaviAperti;
  const tempoMedio = scontrini.length ? Math.round(scontrini.reduce((s, x) => s + x.minuti, 0) / scontrini.length) : 45;
  const critici = magazzino.filter((m) => m.qta < m.soglia);
  const frighiFuori = frighi.filter((f) => f.temp < f.min || f.temp > f.max);
  const menuLive = menu.length ? menu : MENU_FALLBACK;
  const totaleComanda = comanda.reduce((s, r) => s + r.piatto.prezzo * r.qta, 0);

  useEffect(() => {
    if (swOnce.current) return;
    swOnce.current = true;
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js", { updateViaCache: "none" }).then((reg) => { void reg.update(); }).catch(() => {});
      navigator.serviceWorker.addEventListener("message", (e) => {
        if (e.data?.type === "RELOAD" && !sessionStorage.getItem("ml-reloaded")) {
          sessionStorage.setItem("ml-reloaded", "1");
          location.reload();
        }
      });
    }
    wireSync();
  }, []);

  useEffect(() => {
    if (!selezionato) return;
    const live = tavoli.find((t) => t.id === selezionato.id);
    if (live) setSelezionato(live);
  }, [tavoli, selezionato?.id]);

  const apriTavolo = (t: Tavolo) => {
    setSelezionato(t);
    setComanda([]);
  };

  const addToComanda = (p: Piatto) => {
    setComanda((rows) => {
      const found = rows.find((r) => r.piatto.id === p.id);
      if (found) return rows.map((r) => (r.piatto.id === p.id ? { ...r, qta: r.qta + 1 } : r));
      return [...rows, { id: `c-${Date.now()}-${p.id}`, piatto: p, qta: 1 }];
    });
  };

  const inviaComanda = async () => {
    if (!selezionato || !comanda.length) return;
    for (const r of comanda) {
      await useMenteStore.getState().aggiungiOrdine(selezionato.id, r.piatto, r.qta);
      void notifyKds(r.piatto, selezionato.nome);
    }
    setComanda([]);
  };

  const stampaLotto = async () => {
    const zpl = `^XA^FO50,50^A0N,30,30^FD${lottoForm.prodotto.toUpperCase()}^FS^FO50,100^A0N,20,20^FDSCAD:${lottoForm.scadenza}^FS^FO50,130^BQN,2,4^FDQA,LOTTO${lottoForm.lotto}^FS^XZ`;
    useMenteStore.getState().creaLotto(lottoForm);
    try {
      const res = await fetch("/api/print", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ zpl, printer_ip: typeof window !== "undefined" ? localStorage.getItem("printer_ip") : null }),
      });
      const data = await res.json();
      setPrintMsg(data.printed ? "Stampata 70x40" : "ZPL generato • collega stampante");
    } catch {
      setPrintMsg("ZPL generato offline");
    }
  };

  const exportAsl = () => {
    const rows = [
      "Prodotto,Lotto,Apertura,Scadenza,Operatore",
      ...lotti.map((l) => `${l.prodotto},${l.lotto},${l.apertura},${l.scadenza},${l.operatore}`),
      "",
      "Frigo,Temperatura,Min,Max,Stato",
      ...frighi.map((f) => `${f.nome},${f.temp},${f.min},${f.max},${f.temp < f.min || f.temp > f.max ? "FUORI" : "OK"}`),
      "",
      "Log temp,Valore,°C,Quando",
      ...logTemp.slice(0, 50).map((t) => `${t.nome},${t.temp},${new Date(t.ts).toLocaleString("it-IT")},${t.operatore}`),
    ].join("\n");
    const blob = new Blob([rows], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `asl-mente-locale-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
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
      <header className="relative z-20 p-5 flex justify-between items-center border-b border-[#FF1A1A]/10 glass">
        <div className="flex items-center gap-3">
          <img src="/logo-mark.jpg" alt="Mente Locale" className="w-12 h-12 rounded-2xl object-cover border border-[#FF1A1A]/30" />
          <div>
            <p className="font-black text-[13px] tracking-[0.25em]">MENTE LOCALE</p>
            <p className="text-[9px] text-white/30 tracking-widest">{online ? "LIVE" : "OFFLINE"}{codaOffline.length ? ` • CODA ${codaOffline.length}` : ""} • {occupati}/20</p>
          </div>
        </div>
        <button onClick={() => setShowKds(true)} className="relative px-3 py-2 rounded-full bg-[#FF1A1A] text-black text-[10px] font-black tracking-widest">
          KDS
          {kdsCount > 0 && <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-white text-black text-[9px]">{kdsCount}</span>}
        </button>
      </header>
      <main className="relative z-10 p-4 pb-32 max-w-[920px] mx-auto">
        {tab === "tavoli" && (
          <div className="relative w-full h-[68vh] min-h-[420px] rounded-[32px] glass-strong overflow-hidden">
            {tavoli.map((t) => (
              <button key={t.id} onClick={() => apriTavolo(t)} style={{ left: `${t.x}%`, top: `${t.y}%` }} className={`absolute -translate-x-1/2 -translate-y-1/2 w-[72px] h-[72px] rounded-full glass flex flex-col items-center justify-center ${t.stato === "occupato" ? "border-[#00D9FF]/30" : t.stato === "prenotato" ? "border-amber-400/30" : "border-emerald-400/15"}`}>
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
              <button onClick={() => setTab("haccp")} className="rounded-2xl glass p-3 text-left"><p className="text-[9px] text-white/40">MAGAZZINO</p><p className="text-2xl font-black text-[#FF1A1A]">{critici.length}</p></button>
              <button onClick={() => setTab("haccp")} className="rounded-2xl glass p-3 text-left"><p className="text-[9px] text-white/40">HACCP</p><p className="text-2xl font-black text-[#FF1A1A]">{frighiFuori.length}</p></button>
              <button onClick={() => setShowKds(true)} className="rounded-2xl glass p-3 text-left"><p className="text-[9px] text-white/40">KDS APERTO</p><p className="text-2xl font-black">{kdsCount}</p></button>
            </div>
            <div className="rounded-[28px] glass-strong p-5 space-y-3">
              <h2 className="font-black">ANALISI SERATA</h2>
              <p className="text-sm text-white/60">Coperti stimati {occupati * 3} · ticket medio €{scontrini.length ? Math.round(ricaviOggi / Math.max(scontrini.length, 1)) : 29} · top Carbonara.</p>
            </div>
          </div>
        )}
        {tab === "menu" && <MenuTab onAdd={() => setShowAdd(true)} />}
        {tab === "haccp" && (
          <div className="grid gap-4">
            <div className="glass-strong rounded-[24px] p-5">
              <h3 className="font-black">📦 MAGAZZINO</h3>
              {magazzino.map((m) => (
                <div key={m.id} className="flex justify-between p-3 rounded-xl bg-white/5 mt-2">
                  <div><p className="font-semibold">{m.nome}</p><p className="text-xs text-white/40">{m.qta} {m.unita}</p></div>
                  <span className={m.qta < m.soglia ? "text-[#FF6B6B] text-[10px]" : "text-emerald-400 text-[10px]"}>{m.qta < m.soglia ? "sotto scorta" : "ok"}</span>
                </div>
              ))}
            </div>
            <div className="glass-strong rounded-[24px] p-5">
              <h3 className="font-black">📦 LOTTI ATTIVI</h3>
              {lotti.map((l) => (
                <div key={l.id} className="flex justify-between p-3 rounded-xl bg-white/5 mt-2 text-sm">
                  <span>{l.prodotto} • Lotto {l.lotto} • Scad {l.scadenza}</span>
                  <span className={l.giorni_rimasti <= 2 ? "text-red-400" : "text-white/50"}>{l.giorni_rimasti}gg</span>
                </div>
              ))}
            </div>
            <div className="glass-strong rounded-[24px] p-5">
              <h3 className="font-black">🏷️ CREA LOTTO + STAMPA ETICHETTA</h3>
              <input value={lottoForm.prodotto} onChange={(e) => setLottoForm({ ...lottoForm, prodotto: e.target.value })} placeholder="Prodotto" className="w-full p-3 rounded-xl bg-black/30 border border-[#FF1A1A]/10 mt-3" />
              <input value={lottoForm.lotto} onChange={(e) => setLottoForm({ ...lottoForm, lotto: e.target.value })} placeholder="Lotto" className="w-full p-3 rounded-xl bg-black/30 border border-[#FF1A1A]/10 mt-2" />
              <input type="date" value={lottoForm.scadenza} onChange={(e) => setLottoForm({ ...lottoForm, scadenza: e.target.value })} className="w-full p-3 rounded-xl bg-black/30 border border-[#FF1A1A]/10 mt-2" />
              <button onClick={() => void stampaLotto()} className="w-full mt-3 py-3 bg-[#FF1A1A] text-black rounded-full font-black">🖨️ GENERA ZPL + STAMPA 70x40</button>
              {printMsg && <p className="text-[10px] text-white/40 mt-2">{printMsg}</p>}
            </div>
            <div className="glass-strong rounded-[24px] p-5">
              <h3 className="font-black">🌡️ TEMPERATURA FRIGHI • OGNI 2H</h3>
              {frighi.map((f) => {
                const fuori = f.temp < f.min || f.temp > f.max;
                return (
                  <div key={f.id} className="flex gap-2 mt-3 items-center">
                    <span className="flex-1 text-sm">{f.nome} <span className={fuori ? "text-[#FF1A1A]" : "text-emerald-400"}>{f.temp.toFixed(1)}°C</span></span>
                    <input type="number" placeholder="°C" value={tempDraft[f.id] || ""} onChange={(e) => setTempDraft({ ...tempDraft, [f.id]: e.target.value })} className="w-20 p-2 rounded-xl bg-black/30 border border-[#FF1A1A]/10" />
                    <button onClick={() => { const n = Number(tempDraft[f.id]); if (!Number.isNaN(n)) useMenteStore.getState().salvaTemp(f.id, n); }} className="px-3 py-2 bg-white/10 rounded-full text-xs">SALVA</button>
                  </div>
                );
              })}
            </div>
            <div className="glass-strong rounded-[24px] p-5">
              <h3 className="font-black">📄 EXPORT ASL</h3>
              <p className="text-xs text-white/40 mt-2">Genera CSV con lotti, temperature e scadenze. Pronto per controllo ASL.</p>
              <button onClick={exportAsl} className="w-full mt-3 py-3 bg-white text-black rounded-full font-black">📥 SCARICA FILE ASL CSV</button>
            </div>
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

      {showKds && (
        <div className="fixed inset-0 z-50 bg-black/80 p-4 flex items-end justify-center">
          <div className="w-full max-w-[560px] rounded-[28px] glass-strong p-5 max-h-[86vh] overflow-y-auto">
            <div className="flex justify-between items-center">
              <h2 className="font-black">KDS</h2>
              <button onClick={() => setShowKds(false)}>✕</button>
            </div>
            <div className="flex gap-2 mt-3">{(["cucina", "bar"] as Reparto[]).map((r) => (
              <button key={r} onClick={() => setKdsFiltro(r)} className={`text-[10px] px-3 py-1 rounded-full ${kdsFiltro === r ? "bg-[#FF1A1A] text-black font-black" : "glass"}`}>{r.toUpperCase()}</button>
            ))}</div>
            <div className="space-y-2 mt-4">
              {kds.length === 0 && <p className="text-sm text-white/40">Nessun piatto in {kdsFiltro}.</p>}
              {kds.map((o) => (
                <div key={o.id} className="rounded-2xl glass p-4">
                  <p className="font-black">{o.tavolo} · {o.piatto.nome} x{o.qta}</p>
                  <button onClick={() => void useMenteStore.getState().setOrdineStato(o.id, "pronto")} className="text-[10px] mt-2 px-3 py-1 rounded-full bg-emerald-400 text-black font-black">PRONTO</button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

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
          <div className="w-full max-w-[560px] rounded-[28px] glass-strong p-5 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between"><h2 className="font-black">{selezionato.nome} • COMANDA</h2><button onClick={() => { setSelezionato(null); setComanda([]); }}>✕</button></div>
            <p className="text-[10px] text-white/40 mt-1">Aggiungi piatti, swipe SX per togliere, poi invia in cucina</p>
            <div className="grid grid-cols-2 gap-2 mt-4">{menuLive.map((p) => (
              <button key={p.id} onClick={() => addToComanda(p)} className="text-left p-3 rounded-2xl glass"><p className="text-sm font-bold">{p.img} {p.nome}</p><p className="text-[10px] text-white/40">€{p.prezzo} • {p.reparto}</p></button>
            ))}</div>
            {comanda.length > 0 && (
              <div className="mt-4 space-y-2">
                <p className="text-[10px] tracking-widest text-white/40">COMANDA DA INVIARE • €{totaleComanda}</p>
                {comanda.map((r) => (
                  <SwipeRiga key={r.id} onDelete={() => setComanda((rows) => rows.filter((x) => x.id !== r.id))}>
                    <div className="flex justify-between items-center p-3">
                      <span>{r.piatto.img} {r.piatto.nome} x{r.qta}</span>
                      <span className="text-xs text-white/40">€{r.piatto.prezzo * r.qta}</span>
                    </div>
                  </SwipeRiga>
                ))}
                <button onClick={() => void inviaComanda()} className="w-full py-3 rounded-full bg-white text-black font-black">INVIA IN CUCINA / BAR</button>
              </div>
            )}
            {selezionato.ordini.length > 0 && (
              <div className="mt-4 space-y-1">
                <p className="text-[10px] tracking-widest text-white/40">GIÀ INVIATI</p>
                {selezionato.ordini.map((o) => (
                  <div key={o.id} className="text-sm text-white/60 flex justify-between"><span>{o.piatto.nome} x{o.qta}</span><span>{o.stato}</span></div>
                ))}
              </div>
            )}
            <button onClick={() => { void useMenteStore.getState().chiudiTavolo(selezionato.id); setSelezionato(null); setComanda([]); }} className="w-full mt-4 py-3 rounded-full bg-[#FF1A1A] text-black font-black">CHIUDI TAVOLO</button>
          </div>
        </div>
      )}

      <nav className="fixed bottom-4 left-3 right-3 max-w-[760px] mx-auto z-40">
        <div className="rounded-full nav-pill px-3 py-3 flex justify-between items-end">
          {NAV.map((n) => {
            const active = tab === n.id;
            return (
              <button key={n.id} onClick={() => setTab(n.id)} className="flex flex-col items-center min-w-[48px]">
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
