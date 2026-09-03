"use client";

import { useEffect, useRef, useState } from "react";
import { useMenteStore, wireSync } from "@/lib/store";
import { useLocaleStore } from "@/lib/locale-store";
import type { Piatto, Postazione, Reparto, RigaComanda, Tavolo } from "@/lib/types";
import { MenuTab } from "./menu-tab";
import { HaccpTab } from "./haccp-tab";

type Tab = "dashboard" | "tavoli" | "menu" | "haccp" | "ia";

const MENU_FALLBACK: Piatto[] = [{ id: "1", nome: "Carbonara", prezzo: 16, reparto: "cucina", categoria: "Primi", img: "🍝" }];
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
  playFile(piatto.reparto === "bar" ? "/sounds/ding-pronto.wav" : "/sounds/beep-nuovo.wav", piatto.reparto === "bar" ? 980 : 800);
  try {
    if (!("Notification" in window)) return;
    if (Notification.permission === "default") await Notification.requestPermission();
    if (Notification.permission !== "granted") return;
    const reg = await navigator.serviceWorker?.ready;
    if (reg) reg.active?.postMessage({ type: "NOTIFY", title: `KDS ${piatto.reparto.toUpperCase()}`, body: `${piatto.nome} → ${tavoloNome}`, tag: `kds-${piatto.reparto}` });
  } catch {}
}

function Icon({ name, active }: { name: string; active?: boolean }) {
  const stroke = active ? "#FF2A2A" : "rgba(255,255,255,0.86)";
  const common = { width: 22, height: 22, viewBox: "0 0 24 24", fill: "none" as const, stroke, strokeWidth: 1.6, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  if (name === "grid") return (<svg {...common}><rect x="3" y="3" width="7" height="7" rx="1.4" /><rect x="14" y="3" width="7" height="7" rx="1.4" /><rect x="3" y="14" width="7" height="7" rx="1.4" /><rect x="14" y="14" width="7" height="7" rx="1.4" /></svg>);
  if (name === "table") return (<svg {...common}><path d="M4 10h16" /><path d="M8 10v8" /><path d="M16 10v8" /><circle cx="8" cy="7" r="2" /><circle cx="16" cy="7" r="2" /></svg>);
  if (name === "menu") return (<svg {...common}><path d="M4 7h16M4 12h16M4 17h10" /></svg>);
  if (name === "shield") return (<svg {...common}><path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6l8-3z" /></svg>);
  return (<svg {...common}><path d="M12 3c2 3 2 5 2 6a4 4 0 11-8 0c0-1 0-3 2-6z" /></svg>);
}

function SwipeRiga({ children, onDelete }: { children: React.ReactNode; onDelete: () => void }) {
  const [open, setOpen] = useState(false);
  const startX = useRef(0);
  return (
    <div className="relative overflow-hidden rounded-2xl glass" onTouchStart={(e) => { startX.current = e.touches[0].clientX; }} onTouchEnd={(e) => { const dx = e.changedTouches[0].clientX - startX.current; if (dx < -48) setOpen(true); if (dx > 48) setOpen(false); }}>
      <div className={`transition-transform ${open ? "-translate-x-24" : ""}`}>{children}</div>
      {open && <button onClick={onDelete} className="absolute inset-y-0 right-0 w-24 bg-[#FF1A1A] text-black font-black text-xs">ELIMINA</button>}
    </div>
  );
}

function Gate() {
  const setP = useLocaleStore((s) => s.setPostazione);
  const cards: { id: Postazione; title: string; sub: string }[] = [
    { id: "cucina", title: "CUCINA", sub: "Solo KDS cucina" },
    { id: "bar", title: "BAR", sub: "Solo KDS bar" },
    { id: "cameriere", title: "CAMERIERE", sub: "App completa + HACCP" },
  ];
  return (
    <div className="min-h-screen bg-[#050507] text-white flex items-center justify-center p-6">
      <div className="w-full max-w-sm space-y-3">
        <img src="/logo-mark.jpg" alt="ML" className="w-16 h-16 rounded-2xl mx-auto object-cover" />
        <h1 className="text-center font-black tracking-[0.25em]">POSTAZIONE</h1>
        <p className="text-center text-[10px] text-white/40">Scegli da quale stazione accedi</p>
        {cards.map((c) => (
          <button key={c.id} onClick={() => setP(c.id)} className="w-full rounded-[24px] glass-strong p-5 text-left">
            <p className="font-black">{c.title}</p>
            <p className="text-xs text-white/40">{c.sub}</p>
          </button>
        ))}
      </div>
    </div>
  );
}

function KdsOnly({ reparto }: { reparto: Reparto }) {
  const tavoli = useMenteStore((s) => s.tavoli);
  const setP = useLocaleStore((s) => s.setPostazione);
  const kds = tavoli.flatMap((t) => t.ordini.map((o) => ({ ...o, tavolo: t.nome }))).filter((o) => o.piatto.reparto === reparto && o.stato !== "pronto");
  return (
    <div className="min-h-screen bg-[#050507] text-white p-4">
      <div className="flex justify-between items-center mb-4">
        <h1 className="font-black tracking-widest">KDS {reparto.toUpperCase()}</h1>
        <button onClick={() => setP(null)} className="text-[10px] text-white/40">CAMBIA POSTAZIONE</button>
      </div>
      <div className="space-y-2">
        {kds.length === 0 && <p className="text-white/40">Nessun piatto in coda.</p>}
        {kds.map((o) => (
          <div key={o.id} className="rounded-2xl glass p-4">
            <p className="font-black">{o.tavolo} · {o.piatto.nome} x{o.qta}</p>
            <button onClick={() => void useMenteStore.getState().setOrdineStato(o.id, "pronto")} className="text-[10px] mt-2 px-3 py-1 rounded-full bg-emerald-400 text-black font-black">PRONTO</button>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function App() {
  const postazione = useLocaleStore((s) => s.postazione);
  const sale = useLocaleStore((s) => s.sale);
  const [tab, setTab] = useState<Tab>("tavoli");
  const tavoli = useMenteStore((s) => s.tavoli);
  const menu = useMenteStore((s) => s.menu);
  const magazzino = useMenteStore((s) => s.magazzino);
  const frighi = useMenteStore((s) => s.frighi);
  const scontrini = useMenteStore((s) => s.scontrini);
  const online = useMenteStore((s) => s.online);
  const codaOffline = useMenteStore((s) => s.codaOffline);
  const [salaId, setSalaId] = useState("sala-int");
  const [editMap, setEditMap] = useState(false);
  const [nuovaSala, setNuovaSala] = useState("");
  const [selezionato, setSelezionato] = useState<Tavolo | null>(null);
  const [comanda, setComanda] = useState<RigaComanda[]>([]);
  const [showKds, setShowKds] = useState(false);
  const [kdsFiltro, setKdsFiltro] = useState<Reparto>("cucina");
  const [iaOk, setIaOk] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ nome: "", prezzo: "", categoria: "Primi", reparto: "cucina" as Reparto, img: "🍝" });
  const swOnce = useRef(false);
  const occupati = tavoli.filter((t) => t.stato !== "libero").length;
  const tuttiOrdini = tavoli.flatMap((t) => t.ordini.map((o) => ({ ...o, tavolo: t.nome })));
  const kds = tuttiOrdini.filter((o) => o.piatto.reparto === kdsFiltro && o.stato !== "pronto");
  const kdsCount = tuttiOrdini.filter((o) => o.stato !== "pronto").length;
  const ricaviAperti = tavoli.reduce((s, t) => s + t.ordini.reduce((a, o) => a + o.piatto.prezzo * o.qta, 0), 0);
  const ricaviOggi = scontrini.reduce((s, x) => s + x.totale, 0) + ricaviAperti;
  const menuLive = menu.length ? menu : MENU_FALLBACK;
  const visibili = tavoli.filter((t) => (t.salaId || "sala-int") === salaId);

  useEffect(() => {
    if (swOnce.current) return;
    swOnce.current = true;
    if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js", { updateViaCache: "none" }).catch(() => {});
    wireSync();
  }, []);

  useEffect(() => {
    if (!selezionato) return;
    const live = tavoli.find((t) => t.id === selezionato.id);
    if (live) setSelezionato(live);
  }, [tavoli, selezionato?.id]);

  if (!postazione) return <Gate />;
  if (postazione === "cucina") return <KdsOnly reparto="cucina" />;
  if (postazione === "bar") return <KdsOnly reparto="bar" />;

  const inviaComanda = async () => {
    if (!selezionato || !comanda.length) return;
    for (const r of comanda) {
      await useMenteStore.getState().aggiungiOrdine(selezionato.id, r.piatto, r.qta);
      void notifyKds(r.piatto, selezionato.nome);
    }
    setComanda([]);
  };

  return (
    <div className="min-h-screen bg-[#050507] text-white relative overflow-hidden select-none">
      <style>{`.carbon-bg{background-color:#070707;background-image:repeating-linear-gradient(0deg,rgba(255,255,255,.035) 0 1px,transparent 1px 4px)}.glass{backdrop-filter:blur(40px);background:rgba(255,255,255,.03);border:.5px solid rgba(255,26,26,.08)}.glass-strong{backdrop-filter:blur(60px);background:rgba(0,0,0,.62);border:.5px solid rgba(255,26,26,.12)}.nav-pill{background:linear-gradient(180deg,rgba(255,255,255,.1),rgba(8,8,8,.55));border:1px solid rgba(255,70,70,.28)}`}</style>
      <div className="absolute inset-0 carbon-bg opacity-50" />
      <header className="relative z-20 p-4 flex justify-between items-center border-b border-[#FF1A1A]/10 glass">
        <div className="flex items-center gap-3">
          <img src="/logo-mark.jpg" alt="Mente Locale" className="w-11 h-11 rounded-2xl object-cover" />
          <div>
            <p className="font-black text-[12px] tracking-[0.2em]">MENTE LOCALE</p>
            <p className="text-[9px] text-white/30">{online ? "LIVE" : "OFFLINE"} • CAMERIERE • {occupati}/{tavoli.length}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={() => useLocaleStore.getState().setPostazione(null)} className="text-[9px] text-white/40">ESCI</button>
          <button onClick={() => setShowKds(true)} className="relative px-3 py-2 rounded-full bg-[#FF1A1A] text-black text-[10px] font-black">KDS{kdsCount > 0 ? ` ${kdsCount}` : ""}</button>
        </div>
      </header>
      <main className="relative z-10 p-4 pb-32 max-w-[920px] mx-auto">
        {tab === "tavoli" && (
          <div>
            <div className="flex gap-2 overflow-x-auto pb-2">
              {sale.map((s) => (
                <button key={s.id} onClick={() => setSalaId(s.id)} className={`px-3 py-1 rounded-full text-[10px] font-black whitespace-nowrap ${salaId === s.id ? "bg-[#FF1A1A] text-black" : "glass"}`}>{s.nome}</button>
              ))}
              <button onClick={() => setEditMap((v) => !v)} className="px-3 py-1 rounded-full text-[10px] glass">{editMap ? "OK" : "MODIFICA"}</button>
            </div>
            {editMap && (
              <div className="glass-strong rounded-2xl p-3 mb-3 space-y-2">
                <div className="flex gap-2">
                  <input value={nuovaSala} onChange={(e) => setNuovaSala(e.target.value)} placeholder="Nuova sala" className="flex-1 bg-black/30 rounded-xl p-2 text-sm" />
                  <button onClick={() => { useLocaleStore.getState().addSala(nuovaSala, "interna"); setNuovaSala(""); }} className="text-[10px] font-black">+ INT</button>
                  <button onClick={() => { useLocaleStore.getState().addSala(nuovaSala, "esterna"); setNuovaSala(""); }} className="text-[10px] font-black">+ EST</button>
                </div>
                {sale.map((s) => (
                  <div key={s.id} className="flex justify-between text-xs"><span>{s.nome} ({s.tipo})</span><button onClick={() => useLocaleStore.getState().deleteSala(s.id)} className="text-[#FF6B6B]">elimina sala</button></div>
                ))}
                <div className="flex gap-2">
                  <button onClick={() => useLocaleStore.getState().addTavolo(salaId)} className="flex-1 py-2 rounded-full bg-white text-black text-[10px] font-black">+ TAVOLO IN QUESTA SALA</button>
                </div>
              </div>
            )}
            <div className="relative w-full h-[58vh] min-h-[360px] rounded-[32px] glass-strong overflow-hidden">
              {visibili.map((t) => (
                <button key={t.id} onClick={() => { if (editMap) useLocaleStore.getState().deleteTavolo(t.id); else { setSelezionato(t); setComanda([]); } }} style={{ left: `${t.x}%`, top: `${t.y}%` }} className={`absolute -translate-x-1/2 -translate-y-1/2 w-[68px] h-[68px] rounded-full glass flex flex-col items-center justify-center ${t.stato === "occupato" ? "border-[#00D9FF]/30" : "border-white/10"}`}>
                  <span className="text-[11px] font-black">{t.nome}</span>
                  {editMap && <span className="text-[8px] text-[#FF6B6B]">X</span>}
                  {t.ordini.length > 0 && !editMap && <span className="absolute -top-1 -right-1 w-5 h-5 bg-[#FF1A1A] text-black text-[10px] font-black rounded-full">{t.ordini.length}</span>}
                </button>
              ))}
            </div>
          </div>
        )}
        {tab === "dashboard" && (
          <div className="grid grid-cols-3 gap-2">
            <button onClick={() => setTab("tavoli")} className="rounded-2xl glass p-3 text-left"><p className="text-[9px] text-white/40">OCCUPAZIONE</p><p className="text-2xl font-black text-[#00D9FF]">{tavoli.length ? Math.round((occupati / tavoli.length) * 100) : 0}%</p></button>
            <div className="rounded-2xl glass p-3"><p className="text-[9px] text-white/40">RICAVI</p><p className="text-2xl font-black">€{ricaviOggi}</p></div>
            <button onClick={() => setTab("haccp")} className="rounded-2xl glass p-3 text-left"><p className="text-[9px] text-white/40">HACCP</p><p className="text-2xl font-black text-[#FF1A1A]">{frighi.filter((f) => f.temp < f.min || f.temp > f.max).length}</p></button>
            <button onClick={() => setTab("haccp")} className="rounded-2xl glass p-3 text-left"><p className="text-[9px] text-white/40">MAGAZZINO</p><p className="text-2xl font-black">{magazzino.filter((m) => m.qta < m.soglia).length}</p></button>
            <button onClick={() => setShowKds(true)} className="rounded-2xl glass p-3 text-left"><p className="text-[9px] text-white/40">KDS</p><p className="text-2xl font-black">{kdsCount}</p></button>
            <div className="rounded-2xl glass p-3"><p className="text-[9px] text-white/40">TAVOLI</p><p className="text-2xl font-black">{tavoli.length}</p></div>
          </div>
        )}
        {tab === "menu" && <MenuTab onAdd={() => setShowAdd(true)} />}
        {tab === "haccp" && <HaccpTab />}
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
            <div className="flex justify-between"><h2 className="font-black">KDS</h2><button onClick={() => setShowKds(false)}>✕</button></div>
            <div className="flex gap-2 mt-3">{(["cucina", "bar"] as Reparto[]).map((r) => (<button key={r} onClick={() => setKdsFiltro(r)} className={`text-[10px] px-3 py-1 rounded-full ${kdsFiltro === r ? "bg-[#FF1A1A] text-black font-black" : "glass"}`}>{r.toUpperCase()}</button>))}</div>
            {kds.map((o) => (
              <div key={o.id} className="rounded-2xl glass p-4 mt-2"><p className="font-black">{o.tavolo} · {o.piatto.nome} x{o.qta}</p><button onClick={() => void useMenteStore.getState().setOrdineStato(o.id, "pronto")} className="text-[10px] mt-2 px-3 py-1 rounded-full bg-emerald-400 text-black font-black">PRONTO</button></div>
            ))}
          </div>
        </div>
      )}
      {showAdd && (
        <div className="fixed inset-0 z-50 glass-strong p-6 flex items-end justify-center">
          <div className="w-full max-w-md space-y-3">
            <div className="flex justify-between"><h3 className="font-black">NUOVO PRODOTTO</h3><button onClick={() => setShowAdd(false)}>✕</button></div>
            <input placeholder="Nome" value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} className="w-full p-4 rounded-2xl bg-white/5" />
            <input placeholder="Prezzo" type="number" value={form.prezzo} onChange={(e) => setForm({ ...form, prezzo: e.target.value })} className="w-full p-4 rounded-2xl bg-white/5" />
            <button onClick={() => { void useMenteStore.getState().aggiungiProdotto(form); setShowAdd(false); }} className="w-full py-4 bg-[#FF1A1A] text-black rounded-full font-black">SALVA</button>
          </div>
        </div>
      )}
      {selezionato && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-3">
          <div className="w-full max-w-[560px] rounded-[28px] glass-strong p-5 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between"><h2 className="font-black">{selezionato.nome} • COMANDA</h2><button onClick={() => { setSelezionato(null); setComanda([]); }}>✕</button></div>
            <div className="grid grid-cols-2 gap-2 mt-4">{menuLive.map((p) => (<button key={p.id} onClick={() => setComanda((rows) => { const f = rows.find((r) => r.piatto.id === p.id); return f ? rows.map((r) => r.piatto.id === p.id ? { ...r, qta: r.qta + 1 } : r) : [...rows, { id: `c-${Date.now()}-${p.id}`, piatto: p, qta: 1 }]; })} className="text-left p-3 rounded-2xl glass"><p className="text-sm font-bold">{p.img} {p.nome}</p></button>))}</div>
            {comanda.length > 0 && (
              <div className="mt-4 space-y-2">
                {comanda.map((r) => (
                  <SwipeRiga key={r.id} onDelete={() => setComanda((rows) => rows.filter((x) => x.id !== r.id))}>
                    <div className="flex justify-between p-3"><span>{r.piatto.nome} x{r.qta}</span><span>€{r.piatto.prezzo * r.qta}</span></div>
                  </SwipeRiga>
                ))}
                <button onClick={() => void inviaComanda()} className="w-full py-3 rounded-full bg-white text-black font-black">INVIA IN CUCINA / BAR</button>
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
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
