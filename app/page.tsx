"use client";

import { useEffect, useRef, useState } from "react";
import { useMenteStore, wireSync } from "@/lib/store";
import { useLocaleStore } from "@/lib/locale-store";
import { canFullApp, useAuth } from "@/lib/auth";
import { useCassa, type Pagamento } from "@/lib/cassa";
import { apriStampa, ticketHtml } from "@/lib/ticket";
import type { Piatto, Reparto, RigaComanda, Tavolo } from "@/lib/types";
import { MenuTab, ProductThumb } from "./menu-tab";
import { HaccpTab } from "./haccp-tab";
import { CassaTab } from "./cassa-tab";
import { LoginScreen } from "./login-screen";

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

function stampaComanda(tavolo: string, righe: RigaComanda[], locale: string) {
  const cucina = righe.filter((r) => r.piatto.reparto === "cucina");
  const bar = righe.filter((r) => r.piatto.reparto === "bar");
  if (cucina.length) apriStampa(ticketHtml({ tipo: "COMANDA CUCINA", tavolo, ora: oraNow(), locale, righe: cucina.map((r) => ({ nome: r.piatto.nome, qta: r.qta })) }));
  if (bar.length) setTimeout(() => apriStampa(ticketHtml({ tipo: "COMANDA BAR", tavolo, ora: oraNow(), locale, righe: bar.map((r) => ({ nome: r.piatto.nome, qta: r.qta })) })), 400);
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
          <button onClick={() => void useMenteStore.getState().setOrdineStato(o.id, "pronto")} className="text-[10px] mt-2 px-3 py-1 rounded-full bg-emerald-400 text-black font-black">PRONTO</button>
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
  const [salaId, setSalaId] = useState("sala-int");
  const [editMap, setEditMap] = useState(false);
  const [selezionato, setSelezionato] = useState<Tavolo | null>(null);
  const [comanda, setComanda] = useState<RigaComanda[]>([]);
  const [pay, setPay] = useState<Pagamento>("contanti");
  const [showKds, setShowKds] = useState(false);
  const [kdsFiltro, setKdsFiltro] = useState<Reparto>("cucina");
  const swOnce = useRef(false);
  const menuLive = menu.length ? menu : MENU_FALLBACK;
  const visibili = tavoli.filter((t) => (t.salaId || "sala-int") === salaId);
  const tutti = tavoli.flatMap((t) => t.ordini.map((o) => ({ ...o, tavolo: t.nome })));
  const kds = tutti.filter((o) => o.piatto.reparto === kdsFiltro && o.stato !== "pronto");

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

  if (!sessione) return <LoginScreen />;
  if (sessione.ruolo === "cucina") return <KdsOnly reparto="cucina" />;
  if (sessione.ruolo === "bar") return <KdsOnly reparto="bar" />;
  if (!canFullApp(sessione.ruolo)) return <LoginScreen />;

  const inviaComanda = async () => {
    if (!selezionato || !comanda.length) return;
    stampaComanda(selezionato.nome, comanda, sessione.localeNome);
    for (const r of comanda) await useMenteStore.getState().aggiungiOrdine(selezionato.id, r.piatto, r.qta);
    setComanda([]);
  };

  const preconto = () => {
    if (!selezionato) return;
    const righe = selezionato.ordini.map((o) => ({ nome: o.piatto.nome, qta: o.qta, prezzo: o.piatto.prezzo }));
    const totale = righe.reduce((s, r) => s + r.prezzo * r.qta, 0);
    apriStampa(ticketHtml({ tipo: "PRECONTO", tavolo: selezionato.nome, ora: oraNow(), locale: sessione.localeNome, operatore: sessione.staffNome, righe, totale }));
  };

  const paga = () => {
    if (!selezionato) return;
    const righe = selezionato.ordini.map((o) => ({ nome: o.piatto.nome, qta: o.qta, prezzo: o.piatto.prezzo }));
    const totale = righe.reduce((s, r) => s + r.prezzo * r.qta, 0);
    useCassa.getState().emetti({
      tavolo: selezionato.nome,
      tavoloId: selezionato.id,
      righe,
      coperti: selezionato.clienti || 2,
      subtotale: totale,
      sconto: 0,
      totale,
      pagamento: pay,
      operatore: sessione.staffNome,
    });
    apriStampa(ticketHtml({ tipo: "SCONTRINO", tavolo: selezionato.nome, ora: oraNow(), locale: sessione.localeNome, righe, totale }));
    void useMenteStore.getState().chiudiTavolo(selezionato.id);
    setSelezionato(null);
    setComanda([]);
  };

  return (
    <div className="min-h-screen bg-[#050507] text-white relative overflow-hidden select-none">
      <style>{`.glass{backdrop-filter:blur(40px);background:rgba(255,255,255,.03);border:.5px solid rgba(255,26,26,.08)}.glass-strong{backdrop-filter:blur(60px);background:rgba(0,0,0,.62);border:.5px solid rgba(255,26,26,.12)}.nav-pill{background:linear-gradient(180deg,rgba(255,255,255,.1),rgba(8,8,8,.55));border:1px solid rgba(255,70,70,.28)}`}</style>
      <header className="relative z-20 p-4 flex justify-between items-center glass">
        <div>
          <p className="font-black text-[12px] tracking-[0.2em]">{sessione.localeNome.toUpperCase()}</p>
          <p className="text-[9px] text-white/30">{online ? "LIVE" : "OFFLINE"} · {sessione.staffNome}</p>
        </div>
        <div className="flex gap-2">
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
                <button key={t.id} onClick={() => { if (editMap) useLocaleStore.getState().deleteTavolo(t.id); else { setSelezionato(t); setComanda([]); } }} style={{ left: `${t.x}%`, top: `${t.y}%` }} className="absolute -translate-x-1/2 -translate-y-1/2 w-[68px] h-[68px] rounded-full glass flex items-center justify-center">
                  <span className="text-[11px] font-black">{t.nome}</span>
                </button>
              ))}
            </div>
          </div>
        )}
        {tab === "dashboard" && (
          <div className="grid grid-cols-2 gap-2">
            <button onClick={() => setTab("cassa")} className="rounded-2xl glass p-3 text-left"><p className="text-[9px] text-white/40">CASSA</p><p className="text-xl font-black">apri</p></button>
            <button onClick={() => setTab("haccp")} className="rounded-2xl glass p-3 text-left"><p className="text-[9px] text-white/40">HACCP</p><p className="text-xl font-black">registro</p></button>
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
            <div className="flex gap-2 mt-3">{(["cucina", "bar"] as Reparto[]).map((r) => (<button key={r} onClick={() => setKdsFiltro(r)} className={`text-[10px] px-3 py-1 rounded-full ${kdsFiltro === r ? "bg-[#FF1A1A] text-black font-black" : "glass"}`}>{r.toUpperCase()}</button>))}</div>
            {kds.map((o) => (<div key={o.id} className="glass rounded-2xl p-3 mt-2"><p className="font-black">{o.tavolo} {o.piatto.nome}</p><button onClick={() => void useMenteStore.getState().setOrdineStato(o.id, "pronto")} className="text-[10px] mt-2 px-3 py-1 rounded-full bg-emerald-400 text-black font-black">PRONTO</button></div>))}
          </div>
        </div>
      )}
      {selezionato && (
        <div className="fixed inset-0 z-50 flex items-end bg-black/70 p-3">
          <div className="w-full max-w-[560px] mx-auto rounded-[28px] glass-strong p-5 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between"><h2 className="font-black">{selezionato.nome}</h2><button onClick={() => setSelezionato(null)}>✕</button></div>
            <div className="grid grid-cols-2 gap-2 mt-4">{menuLive.map((p) => (
              <button key={p.id} onClick={() => setComanda((rows) => { const f = rows.find((r) => r.piatto.id === p.id); return f ? rows.map((r) => r.piatto.id === p.id ? { ...r, qta: r.qta + 1 } : r) : [...rows, { id: `c-${Date.now()}`, piatto: p, qta: 1 }]; })} className="text-left p-2.5 rounded-2xl glass flex items-center gap-2">
                <ProductThumb src={p.img} alt={p.nome} size={40} />
                <div className="min-w-0">
                  <p className="text-sm font-bold truncate">{p.nome}</p>
                  <p className="text-[10px] text-white/40">€{p.prezzo} · {p.categoria}</p>
                </div>
              </button>
            ))}</div>
            {comanda.length > 0 && <button onClick={() => void inviaComanda()} className="w-full mt-3 py-3 rounded-full bg-white text-black font-black">INVIA + STAMPA COMANDA</button>}
            {selezionato.ordini.length > 0 && (
              <div className="mt-3 space-y-2">
                {selezionato.ordini.map((o) => <p key={o.id} className="text-sm text-white/60">{o.piatto.nome} x{o.qta}</p>)}
                <div className="flex gap-2">{(["contanti", "carta", "satispay"] as Pagamento[]).map((p) => (
                  <button key={p} onClick={() => setPay(p)} className={`flex-1 py-2 rounded-full text-[10px] font-black ${pay === p ? "bg-[#FF1A1A] text-black" : "glass"}`}>{p}</button>
                ))}</div>
                <button onClick={preconto} className="w-full py-3 rounded-full glass font-black text-sm">PRECONTO</button>
                <button onClick={paga} className="w-full py-3 rounded-full bg-[#FF1A1A] text-black font-black">PAGA E CHIUDI</button>
              </div>
            )}
          </div>
        </div>
      )}
      <nav className="fixed bottom-4 left-3 right-3 max-w-[760px] mx-auto z-40">
        <div className="rounded-full nav-pill px-3 py-3 flex justify-between">
          {NAV.map((n) => (
            <button key={n.id} onClick={() => setTab(n.id)} className="flex flex-col items-center min-w-[48px]">
              <Icon name={n.icon} active={tab === n.id} />
              <span className={`text-[8px] mt-1 ${tab === n.id ? "text-[#FF2A2A]" : "text-white/45"}`}>{n.label}</span>
            </button>
          ))}
        </div>
      </nav>
    </div>
  );
}
