"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useMenteStore, wireSync } from "@/lib/store";
import type { Piatto, Reparto, StatoOrdine, Tavolo } from "@/lib/types";

function ProdottoRow({ p, onDelete }: { p: Piatto; onDelete: (id: string) => void }) {
  const [showDelete, setShowDelete] = useState(false);
  const startX = useRef(0);
  return (
    <div
      className="relative overflow-hidden rounded-2xl glass"
      onTouchStart={(e) => {
        startX.current = e.touches[0].clientX;
      }}
      onTouchEnd={(e) => {
        const dx = e.changedTouches[0].clientX - startX.current;
        if (dx < -48) setShowDelete(true);
        if (dx > 48) setShowDelete(false);
      }}
      onMouseDown={(e) => {
        startX.current = e.clientX;
      }}
      onMouseUp={(e) => {
        const dx = e.clientX - startX.current;
        if (dx < -48) setShowDelete(true);
        if (dx > 48) setShowDelete(false);
      }}
    >
      <div className="flex justify-between items-center p-4">
        <span>
          {p.img} {p.nome} • €{p.prezzo}
        </span>
        <span className="text-[10px] text-white/40 tracking-widest">
          {p.categoria} • {p.reparto.toUpperCase()}
        </span>
      </div>
      {showDelete && (
        <div className="absolute inset-0 bg-[#FF1A1A] flex justify-end items-center pr-6">
          <button onClick={() => onDelete(p.id)} className="text-black font-black">
            ELIMINA ✕
          </button>
        </div>
      )}
    </div>
  );
}

type Tab =
  | "dashboard"
  | "tavoli"
  | "prenotazioni"
  | "analisi"
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
  { id: "analisi", label: "Analisi", icon: "chart" },
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
    } catch {
      /* ignore */
    }
  });
}

async function notifyKds(piatto: Piatto, tavoloNome: string) {
  const title = `KDS ${piatto.reparto.toUpperCase()}`;
  const body = `${piatto.nome} → ${tavoloNome}`;
  playFile(piatto.reparto === "bar" ? "/sounds/ding-pronto.wav" : "/sounds/beep-nuovo.wav", piatto.reparto === "bar" ? 980 : 800);
  try {
    if (typeof window === "undefined" || !("Notification" in window)) return;
    if (Notification.permission === "default") await Notification.requestPermission();
    if (Notification.permission !== "granted") return;
    const reg = await navigator.serviceWorker?.ready;
    if (reg) {
      reg.active?.postMessage({ type: "NOTIFY", title, body, tag: `kds-${piatto.reparto}`, url: "/?tab=kds" });
    } else {
      new Notification(title, { body, icon: "/logo-mark.jpg", tag: `kds-${piatto.reparto}` });
    }
  } catch {
    /* notifications blocked */
  }
}

function Icon({ name, active }: { name: string; active?: boolean }) {
  const stroke = active ? "#FF2A2A" : "rgba(255,255,255,0.86)";
  const common = {
    width: 22,
    height: 22,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke,
    strokeWidth: 1.6,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };
  if (name === "grid") {
    return (
      <svg {...common}>
        <rect x="3" y="3" width="7" height="7" rx="1.4" />
        <rect x="14" y="3" width="7" height="7" rx="1.4" />
        <rect x="3" y="14" width="7" height="7" rx="1.4" />
        <rect x="14" y="14" width="7" height="7" rx="1.4" />
      </svg>
    );
  }
  if (name === "table") {
    return (
      <svg {...common}>
        <path d="M4 10h16" />
        <path d="M8 10v8" />
        <path d="M16 10v8" />
        <circle cx="8" cy="7" r="2" />
        <circle cx="16" cy="7" r="2" />
        <path d="M6 18h4M14 18h4" />
      </svg>
    );
  }
  if (name === "cal") {
    return (
      <svg {...common}>
        <rect x="4" y="5" width="16" height="15" rx="2" />
        <path d="M8 3v4M16 3v4M4 10h16" />
        <path d="M9 15l2 2 4-4" />
      </svg>
    );
  }
  if (name === "chart") {
    return (
      <svg {...common}>
        <path d="M5 19V10" />
        <path d="M10 19V6" />
        <path d="M15 19v-7" />
        <path d="M20 19V4" />
      </svg>
    );
  }
  if (name === "box") {
    return (
      <svg {...common}>
        <path d="M12 3l8 4.5v9L12 21l-8-4.5v-9L12 3z" />
        <path d="M12 12l8-4.5M12 12v9M12 12L4 7.5" />
      </svg>
    );
  }
  if (name === "shield") {
    return (
      <svg {...common}>
        <path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6l8-3z" />
        <path d="M9 12l2 2 4-4" />
      </svg>
    );
  }
  if (name === "screen") {
    return (
      <svg {...common}>
        <rect x="3" y="5" width="18" height="12" rx="2" />
        <path d="M8 21h8M12 17v4" />
      </svg>
    );
  }
  return (
    <svg {...common}>
      <path d="M12 3c2 3 2 5 2 6a4 4 0 11-8 0c0-1 0-3 2-6 1 3 3 3 4 0z" />
      <path d="M8.5 16c.6 2 1.8 3.5 3.5 4.5 1.7-1 2.9-2.5 3.5-4.5" />
      <circle cx="18" cy="6" r="1" fill={stroke} />
      <circle cx="20" cy="9" r="0.8" fill={stroke} />
    </svg>
  );
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
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setInstallEvt(e);
    };
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

  const attivaNotifiche = async () => {
    if (!("Notification" in window)) return;
    const perm = await Notification.requestPermission();
    setNotifOn(perm === "granted");
  };

  const installaApp = async () => {
    if (!installEvt?.prompt) return;
    installEvt.prompt();
    await installEvt.userChoice;
    setInstallEvt(null);
  };

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

  const setOrdineStato = (ordineId: string, stato: StatoOrdine) => {
    void useMenteStore.getState().setOrdineStato(ordineId, stato);
    if (stato === "pronto") playFile("/sounds/ding-pronto.wav", 980);
  };

  const chiudiTavolo = (id: number) => {
    void useMenteStore.getState().chiudiTavolo(id);
    setSelezionato(null);
  };

  return (
    <div className="min-h-screen bg-[#050507] text-white relative overflow-hidden select-none">
      <style>{`
        @keyframes pulse-red {
          0% { box-shadow: 0 0 0 0 rgba(255,26,26,0.7), 0 0 30px rgba(255,26,26,0.3); }
          50% { box-shadow: 0 0 0 20px rgba(255,26,26,0), 0 0 60px rgba(255,26,26,0.6); }
          100% { box-shadow: 0 0 0 0 rgba(255,26,26,0), 0 0 30px rgba(255,26,26,0.3); }
        }
        @keyframes glow-cyan {
          0%,100% { box-shadow: 0 0 20px rgba(0,217,255,0.2), inset 0 1px 1px rgba(255,255,255,0.1); }
          50% { box-shadow: 0 0 40px rgba(0,217,255,0.4), inset 0 1px 1px rgba(255,255,255,0.15); }
        }
        .carbon-bg {
          background-color: #070707;
          background-image:
            url('/textures/carbon_texture.jpg'),
            repeating-linear-gradient(0deg, rgba(255,255,255,0.035) 0 1px, transparent 1px 4px),
            repeating-linear-gradient(90deg, rgba(255,255,255,0.035) 0 1px, transparent 1px 4px);
          background-size: 280px, 4px 4px, 4px 4px;
        }
        .glass {
          backdrop-filter: blur(40px);
          -webkit-backdrop-filter: blur(40px);
          background: rgba(255,255,255,0.03);
          border: 0.5px solid rgba(255,26,26,0.08);
        }
        .glass-strong {
          backdrop-filter: blur(60px);
          -webkit-backdrop-filter: blur(60px);
          background: rgba(0,0,0,0.62);
          border: 0.5px solid rgba(255,26,26,0.12);
          box-shadow: inset 0 1px 1px rgba(255,255,255,0.08), 0 20px 80px rgba(0,0,0,0.9), 0 0 20px rgba(255,26,26,0.05);
        }
        .nav-pill {
          background: linear-gradient(180deg, rgba(255,255,255,0.10), rgba(8,8,8,0.55));
          border: 1px solid rgba(255,70,70,0.28);
          box-shadow:
            0 0 0 1px rgba(255,26,26,0.18),
            0 0 24px rgba(255,26,26,0.16),
            inset 0 1px 0 rgba(255,255,255,0.22),
            inset 0 -10px 24px rgba(0,0,0,0.35);
        }
      `}</style>

      <div className="absolute inset-0 carbon-bg opacity-50" />
      <div className="absolute inset-0 bg-gradient-to-br from-[#FF1A1A]/[0.05] via-transparent to-[#00D9FF]/[0.03]" />

      <header className="relative z-20 p-5 flex justify-between border-b border-[#FF1A1A]/10 glass">
        <div className="flex items-center gap-3">
          <img src="/logo-mark.jpg" alt="Mente Locale" className="w-12 h-12 rounded-2xl object-cover border border-[#FF1A1A]/30 shadow-[0_0_16px_rgba(255,26,26,0.35)]" />
          <div>
            <p className="font-black text-[13px] tracking-[0.25em]">MENTE LOCALE</p>
            <p className="text-[9px] text-white/30 tracking-widest">CARBON EDITION • 20 TAVOLI</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {!notifOn && (
            <button onClick={attivaNotifiche} className="text-[9px] tracking-widest px-3 py-1.5 rounded-full glass">ATTIVA PUSH</button>
          )}
          {installEvt && (
            <button onClick={installaApp} className="text-[9px] tracking-widest px-3 py-1.5 rounded-full bg-[#FF1A1A] text-black font-black">INSTALLA</button>
          )}
          <div className="text-[10px] text-white/40">
            {online ? "LIVE" : "OFFLINE"}
            {codaOffline.length > 0 ? ` • CODA ${codaOffline.length}` : ""} • {occupati}/20
          </div>
        </div>
      </header>

      <main className="relative z-10 p-4 pb-32 max-w-[920px] mx-auto">
        {tab === "tavoli" && (
          <>
            <div className="relative w-full h-[68vh] min-h-[420px] rounded-[32px] glass-strong overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-white/[0.04] to-transparent pointer-events-none" />
              {tavoli.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setSelezionato(t)}
                  style={{ left: `${t.x}%`, top: `${t.y}%` }}
                  className={`absolute -translate-x-1/2 -translate-y-1/2 w-[72px] h-[72px] rounded-full flex flex-col items-center justify-center transition-all duration-500 glass
                    ${t.stato === "libero" ? "border-emerald-400/15 hover:border-emerald-400/40" : t.stato === "occupato" ? "border-[#00D9FF]/30" : t.stato === "prenotato" ? "border-amber-400/30" : "border-[#FF1A1A]/30"}
                    ${t.animazione === "pulse" ? "animate-[pulse-red_1s_ease-out_2]" : t.stato === "occupato" ? "animate-[glow-cyan_3s_ease-in-out_infinite]" : ""}`}
                >
                  <span className="text-[11px] font-black">{t.nome}</span>
                  <span className="text-[7px] text-white/40">{t.posti}P • {t.clienti}CLI</span>
                  {t.ordini.length > 0 && (
                    <span className="absolute -top-1 -right-1 w-5 h-5 bg-[#FF1A1A] text-black text-[10px] font-black rounded-full flex items-center justify-center shadow-[0_0_12px_#FF1A1A] animate-pulse">{t.ordini.length}</span>
                  )}
                </button>
              ))}
            </div>
          </>
        )}

        {tab === "dashboard" && (
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-2">
              <button onClick={() => setTab("tavoli")} className="rounded-2xl glass p-3 text-left">
                <p className="text-[9px] text-white/40 tracking-widest">OCCUPAZIONE</p>
                <p className="text-2xl font-black text-[#00D9FF]">{Math.round((occupati / 20) * 100)}%</p>
                <p className="text-[10px] text-white/50">{occupati}/20 • LIVE da tavoli</p>
              </button>
              <div className="rounded-2xl glass p-3">
                <p className="text-[9px] text-white/40 tracking-widest">RICAVI</p>
                <p className="text-2xl font-black text-[#FF6B6B]">€{ricaviOggi}</p>
                <p className="text-[10px] text-white/50">scontrini oggi + aperti</p>
              </div>
              <div className="rounded-2xl glass p-3">
                <p className="text-[9px] text-white/40 tracking-widest">TEMPO MEDIO</p>
                <p className="text-2xl font-black">{tempoMedio}min</p>
                <p className="text-[10px] text-white/50">da chiusura tavoli</p>
              </div>
              <button onClick={() => setTab("magazzino")} className="rounded-2xl glass p-3 text-left">
                <p className="text-[9px] text-white/40 tracking-widest">MAGAZZINO</p>
                <p className={`text-2xl font-black ${critici.length ? "text-[#FF1A1A]" : "text-emerald-400"}`}>{critici.length}</p>
                <p className="text-[10px] text-white/50">prodotti sotto soglia</p>
              </button>
              <button onClick={() => setTab("haccp")} className="rounded-2xl glass p-3 text-left">
                <p className="text-[9px] text-white/40 tracking-widest">HACCP</p>
                <p className={`text-2xl font-black ${frighiFuori.length ? "text-[#FF1A1A]" : "text-emerald-400"}`}>{frighiFuori.length}</p>
                <p className="text-[10px] text-white/50">frighi fuori temp</p>
              </button>
              <button onClick={() => setTab("prenotazioni")} className={`rounded-2xl glass p-3 text-left ${prenWa.length ? "animate-[pulse-red_1.4s_ease-out_infinite] border border-[#FF1A1A]/50" : ""}`}>
                <p className="text-[9px] text-white/40 tracking-widest">PRENOTAZIONI</p>
                <p className="text-2xl font-black">{prenOggi.length}</p>
                <p className={`text-[10px] ${prenWa.length ? "text-[#FF6B6B] font-bold" : "text-white/50"}`}>{prenWa.length} da WhatsApp da confermare</p>
              </button>
            </div>
            <div className="rounded-2xl glass-strong p-4">
              <p className="text-[10px] tracking-widest text-white/40 mb-3">MENU LIVE • SWIPE SX PER ELIMINARE</p>
              <div className="space-y-2">
                {menuLive.map((p) => (
                  <ProdottoRow key={p.id} p={p} onDelete={(id) => void useMenteStore.getState().eliminaProdotto(id)} />
                ))}
              </div>
              <button onClick={() => setShowAdd(true)} className="w-full mt-3 py-4 rounded-full bg-white text-black font-black">+ AGGIUNGI PRODOTTO</button>
            </div>
          </div>
        )}

        {tab === "prenotazioni" && (
          <div className="space-y-3">
            <h2 className="font-black tracking-widest text-sm">PRENOTAZIONI</h2>
            {prenotazioni.map((p) => (
              <div key={p.id} className={`rounded-2xl glass p-4 flex justify-between items-center ${p.stato === "da_confermare" && p.fonte === "whatsapp" ? "animate-[pulse-red_1.4s_ease-out_infinite]" : ""}`}>
                <div>
                  <p className="font-bold">{p.nome}</p>
                  <p className="text-xs text-white/40">{p.persone} persone • {p.tavolo} • {p.quando} • {p.fonte.toUpperCase()}</p>
                </div>
                {p.stato === "da_confermare" ? (
                  <button onClick={() => useMenteStore.getState().confermaPrenotazione(p.id)} className="text-[10px] px-3 py-1 rounded-full bg-[#FF1A1A] text-black font-black">CONFERMA WA</button>
                ) : (
                  <span className={`text-[10px] px-3 py-1 rounded-full border ${p.stato === "vip" ? "border-amber-400 text-amber-300" : p.stato === "cancellata" ? "border-[#FF1A1A]/50 text-[#FF6B6B]" : "border-[#00D9FF]/40 text-[#00D9FF]"}`}>{p.stato.replace("_", " ").toUpperCase()}</span>
                )}
              </div>
            ))}
          </div>
        )}

        {tab === "analisi" && (
          <div className="rounded-[28px] glass-strong p-5 space-y-3">
            <h2 className="font-black">ANALISI SERATA</h2>
            <p className="text-sm text-white/60">Coperti stimati 42 · ticket medio €29,50 · top piatto Carbonara.</p>
          </div>
        )}

        {tab === "magazzino" && (
          <div className="space-y-2">
            <h2 className="font-black tracking-widest text-sm mb-3">MAGAZZINO</h2>
            {magazzino.map((m) => {
              const stato = m.qta < m.soglia ? "sotto scorta" : m.qta < m.soglia * 1.5 ? "attenzione" : "ok";
              return (
                <div key={m.id} className="glass rounded-2xl p-4 flex justify-between">
                  <div>
                    <p className="font-semibold">{m.nome}</p>
                    <p className="text-xs text-white/40">{m.qta} {m.unita} • soglia {m.soglia}</p>
                  </div>
                  <span className={`text-[10px] ${stato === "ok" ? "text-emerald-400" : stato === "attenzione" ? "text-amber-300" : "text-[#FF6B6B]"}`}>{stato}</span>
                </div>
              );
            })}
          </div>
        )}

        {tab === "haccp" && (
          <div className="rounded-[28px] glass-strong p-5">
            <h2 className="font-black mb-3">HACCP PRO</h2>
            <div className="grid grid-cols-2 gap-2 mb-4">
              {frighi.map((f) => {
                const fuori = f.temp < f.min || f.temp > f.max;
                return (
                  <div key={f.id} className={`rounded-2xl glass p-3 ${fuori ? "border border-[#FF1A1A]/60" : ""}`}>
                    <p className="text-[10px] text-white/40">{f.nome}</p>
                    <p className={`text-xl font-black ${fuori ? "text-[#FF1A1A]" : "text-emerald-400"}`}>{f.temp.toFixed(1)}°C</p>
                    <p className="text-[9px] text-white/30">range {f.min}–{f.max}°C</p>
                  </div>
                );
              })}
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <input value={prodotto} onChange={(e) => setProdotto(e.target.value)} className="bg-black/40 border border-white/10 rounded-xl p-3" />
              <input value={lotto} onChange={(e) => setLotto(e.target.value)} className="bg-black/40 border border-white/10 rounded-xl p-3" />
              <input type="date" value={dataApertura} onChange={(e) => setDataApertura(e.target.value)} className="bg-black/40 border border-white/10 rounded-xl p-3 col-span-2" />
            </div>
            <button className="w-full mt-3 rounded-xl py-3 font-black bg-[#FF1A1A] text-black">GENERA ETICHETTA ZPL 70x40</button>
            <div className="mt-3 p-3 bg-white text-black rounded-xl text-[10px] font-mono">
              <p className="uppercase font-bold">{prodotto}</p>
              <p>Aperto: {labelPreview.open} - Scad: {labelPreview.scad}</p>
              <p>Lotto: {lotto} - Op: Marco</p>
            </div>
          </div>
        )}

        {tab === "kds" && (
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <h2 className="font-black tracking-widest text-sm">KDS LIVE</h2>
              <div className="flex gap-2">
                {(["cucina", "bar"] as Reparto[]).map((r) => (
                  <button key={r} onClick={() => setKdsFiltro(r)} className={`text-[10px] px-3 py-1 rounded-full tracking-widest ${kdsFiltro === r ? "bg-[#FF1A1A] text-black font-black" : "glass text-white/50"}`}>{r.toUpperCase()}</button>
                ))}
              </div>
            </div>
            {kds.length === 0 && <p className="text-white/30 text-sm glass rounded-2xl p-6 text-center">Nessuna comanda in {kdsFiltro}.</p>}
            {kds.map((o) => (
              <div key={o.id} className={`rounded-2xl glass p-4 border-l-4 ${o.stato === "ordinato" ? "border-[#FF1A1A]" : "border-amber-400"}`}>
                <div className="flex justify-between">
                  <p className="font-black">{o.tavolo} · {o.piatto.img} {o.piatto.nome} x{o.qta}</p>
                  <p className="text-xs text-white/40">{o.ora}</p>
                </div>
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
            <p className="text-sm text-white/70 mt-3">{iaOk ? "Ordine inviato a Rossi. 4kg di mozzarella in arrivo venerdì mattina." : "Sergio, per sabato hai 18 prenotati: servono 4kg di mozzarella in più. Ordino da Rossi?"}</p>
            {!iaOk && (
              <div className="flex gap-2 mt-4">
                <button onClick={() => setIaOk(true)} className="text-xs bg-white text-black px-4 py-2 rounded-full font-black">Sì, ordina</button>
                <button className="text-xs glass px-4 py-2 rounded-full">Dimmi di più</button>
              </div>
            )}
          </div>
        )}
      </main>

      {showAdd && (
        <div className="fixed inset-0 z-50 glass-strong p-6 flex items-end sm:items-center justify-center">
          <div className="w-full max-w-md space-y-3">
            <div className="flex justify-between items-center">
              <h3 className="font-black tracking-widest">NUOVO PRODOTTO</h3>
              <button onClick={() => setShowAdd(false)} className="w-9 h-9 rounded-full glass">✕</button>
            </div>
            <input placeholder="Nome es Carbonara" value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} className="w-full p-4 rounded-2xl bg-white/5 border border-[#FF1A1A]/10" />
            <input placeholder="Prezzo 16" type="number" value={form.prezzo} onChange={(e) => setForm({ ...form, prezzo: e.target.value })} className="w-full p-4 rounded-2xl bg-white/5 border border-[#FF1A1A]/10" />
            <div className="grid grid-cols-2 gap-2">
              {(["Primi", "Secondi", "Cocktail", "Dolci"] as const).map((c) => (
                <button key={c} onClick={() => setForm({ ...form, categoria: c, reparto: c === "Cocktail" ? "bar" : "cucina" })} className={`py-3 rounded-2xl text-xs ${form.categoria === c ? "bg-[#FF1A1A] text-black font-black" : "glass"}`}>{c}</button>
              ))}
            </div>
            <button onClick={() => { void useMenteStore.getState().aggiungiProdotto(form); setShowAdd(false); setForm({ nome: "", prezzo: "", categoria: "Primi", reparto: "cucina", img: "🍝" }); }} className="w-full mt-2 py-4 bg-[#FF1A1A] text-black rounded-full font-black">SALVA • VA SUBITO IN TUTTI I TELEFONI</button>
          </div>
        </div>
      )}

      {selezionato && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-xl p-3">
          <div className="w-full max-w-[560px] rounded-[28px] glass-strong max-h-[88vh] flex flex-col overflow-hidden">
            <div className="p-5 flex justify-between border-b border-white/5">
              <div>
                <h2 className="text-xl font-black">{selezionato.nome} • {selezionato.clienti} persone • {selezionato.cameriere}</h2>
                <p className="text-xs text-white/40">Totale €{selezionato.ordini.reduce((s, o) => s + o.piatto.prezzo * o.qta, 0)} • {selezionato.ordini.length} piatti</p>
              </div>
              <button onClick={() => setSelezionato(null)} className="w-9 h-9 rounded-full glass">✕</button>
            </div>
            <div className="p-5 space-y-4 overflow-y-auto flex-1">
              <div className="space-y-2">
                {selezionato.ordini.map((o) => (
                  <div key={o.id} className="flex justify-between p-3 rounded-2xl glass">
                    <span>{o.qta}x {o.piatto.img} {o.piatto.nome} → {o.piatto.reparto.toUpperCase()}</span>
                    <span className="text-xs text-white/50">{o.stato}</span>
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-2">
                {menuLive.map((p) => (
                  <button key={p.id} onClick={() => aggiungiOrdine(selezionato.id, p)} className="text-left p-3 rounded-2xl glass hover:bg-white/[0.06]">
                    <p className="text-sm font-bold">{p.img} {p.nome}</p>
                    <p className="text-[9px] text-white/40">{p.categoria} • {p.reparto.toUpperCase()} • €{p.prezzo}</p>
                  </button>
                ))}
              </div>
            </div>
            <div className="p-3 grid grid-cols-3 gap-2 border-t border-white/5">
              <button className="py-3 rounded-full glass text-xs">SPOSTA</button>
              <button className="py-3 rounded-full bg-[#00D9FF]/20 border border-[#00D9FF]/30 text-xs font-bold">CONTO DIVISO</button>
              <button onClick={() => chiudiTavolo(selezionato.id)} className="py-3 rounded-full bg-[#FF1A1A] text-black text-xs font-black">CHIUDI €{selezionato.ordini.reduce((s, o) => s + o.piatto.prezzo * o.qta, 0)}</button>
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
                <span className={active ? "drop-shadow-[0_0_8px_#FF1A1A]" : ""}><Icon name={n.icon} active={active} /></span>
                <span className={`text-[8px] mt-1 tracking-widest ${active ? "text-[#FF2A2A]" : "text-white/45"}`}>{n.label}</span>
                {active && <div className="w-1 h-1 bg-[#FF1A1A] rounded-full mt-1 shadow-[0_0_6px_#FF1A1A]" />}
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
