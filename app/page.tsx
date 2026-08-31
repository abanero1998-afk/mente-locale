"use client";

import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

type StatoTavolo = "libero" | "occupato" | "prenotato" | "servizio" | "cancellato";
type Tab = "dashboard" | "tavoli" | "prenotazioni" | "analisi" | "magazzino" | "haccp";

type Tavolo = {
  id: string;
  nome: string;
  stato: StatoTavolo;
  persone: number;
  cliente?: string;
  tempo?: string;
  posti: number;
};

type Piatto = {
  nome: string;
  qta: number;
  reparto: "cucina" | "bar";
  allergeni?: string[];
  note?: string;
};

type Comanda = {
  id: string;
  tavolo: string;
  piatti: Piatto[];
  stato: "nuovo" | "in_prep" | "pronto";
  ora: string;
  cameriere: string;
};

type Prenotazione = {
  initials: string;
  nome: string;
  vip?: boolean;
  dettagli: string;
  stato: "Confermata" | "VIP" | "Cancellata";
  color: "cyan" | "gold" | "red";
};

const NAV: { id: Tab; icon: string; label: string }[] = [
  { id: "dashboard", icon: "⊞", label: "Dashboard" },
  { id: "tavoli", icon: "⫶", label: "Tavoli" },
  { id: "prenotazioni", icon: "📅", label: "Prenotazioni" },
  { id: "analisi", icon: "📊", label: "Analisi" },
  { id: "magazzino", icon: "📦", label: "Magazzino" },
  { id: "haccp", icon: "🧊", label: "HACCP" },
];

const INITIAL_TAVOLI: Tavolo[] = [
  { id: "1", nome: "T01", stato: "prenotato", persone: 2, cliente: "Caterina Bianchi", tempo: "21:00", posti: 2 },
  { id: "2", nome: "T02", stato: "cancellato", persone: 0, posti: 4 },
  { id: "3", nome: "T03", stato: "occupato", persone: 4, cliente: "Mario Rossi", tempo: "45min", posti: 4 },
  { id: "4", nome: "T04", stato: "libero", persone: 0, posti: 2 },
  { id: "5", nome: "T05", stato: "libero", persone: 0, posti: 6 },
  { id: "6", nome: "T06", stato: "occupato", persone: 2, cliente: "Anna Neri", tempo: "18min", posti: 2 },
];

const INITIAL_KDS: Comanda[] = [
  {
    id: "k1",
    tavolo: "T03",
    piatti: [{ nome: "Carbonara", qta: 2, reparto: "cucina", allergeni: ["Uova"], note: "Senza pecorino 1x" }],
    stato: "nuovo",
    ora: "21:42",
    cameriere: "Luca",
  },
  {
    id: "k2",
    tavolo: "T01",
    piatti: [{ nome: "Cacio e Pepe", qta: 2, reparto: "cucina" }],
    stato: "in_prep",
    ora: "21:40",
    cameriere: "Sara",
  },
];

const PRENOTAZIONI: Prenotazione[] = [
  { initials: "MR", nome: "Mario Rossi", dettagli: "4 persone • T03 • Oggi 20:30", stato: "Confermata", color: "cyan" },
  { initials: "CB", nome: "Caterina Bianchi", vip: true, dettagli: "2 persone • T01 • Oggi 21:00", stato: "VIP", color: "gold" },
  { initials: "LV", nome: "Luca Verdi", dettagli: "6 persone • T02 • Oggi 19:00", stato: "Cancellata", color: "red" },
  { initials: "AN", nome: "Anna Neri", dettagli: "2 persone • T06 • Oggi 20:00", stato: "Confermata", color: "cyan" },
];

function playSound(tipo: "nuovo" | "pronto" | "ritardo") {
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = tipo === "pronto" ? "sine" : tipo === "ritardo" ? "sawtooth" : "square";
    osc.frequency.value = tipo === "pronto" ? 880 : tipo === "ritardo" ? 220 : 640;
    gain.gain.setValueAtTime(0.08, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.28);
    osc.start();
    osc.stop(ctx.currentTime + 0.28);
  } catch {
    /* audio blocked */
  }
}

function statoClass(stato: StatoTavolo) {
  if (stato === "libero") return "border-green-400/50 bg-green-500/10 shadow-[0_0_20px_rgba(34,197,94,0.3)] text-green-400";
  if (stato === "occupato" || stato === "servizio") return "border-cyan-400/50 bg-cyan-500/10 shadow-[0_0_20px_rgba(0,217,255,0.3)] text-cyan-400";
  if (stato === "prenotato") return "border-yellow-400/50 bg-yellow-500/10 shadow-[0_0_20px_rgba(250,204,21,0.3)] text-yellow-400";
  return "border-red-400/50 bg-red-500/10 text-red-400";
}

function statoLabel(t: Tavolo) {
  if (t.stato === "prenotato") return "Riservato";
  return t.stato;
}

export default function MenteLocaleApp() {
  const [tab, setTab] = useState<Tab>("dashboard");
  const [tavoli, setTavoli] = useState<Tavolo[]>(INITIAL_TAVOLI);
  const [kdsCucina, setKdsCucina] = useState<Comanda[]>(INITIAL_KDS);
  const [prodotto, setProdotto] = useState("Mozzarella fiordilatte");
  const [lotto, setLotto] = useState("L12345");
  const [dataApertura, setDataApertura] = useState("2026-09-01");
  const [iaOk, setIaOk] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => {
      if (Math.random() > 0.7) playSound("nuovo");
    }, 15000);
    return () => clearInterval(interval);
  }, []);

  const occupati = tavoli.filter((t) => t.stato === "occupato" || t.stato === "prenotato" || t.stato === "servizio").length;
  const occupazione = Math.round((occupati / tavoli.length) * 100);

  const labelPreview = useMemo(() => {
    const open = new Date(dataApertura);
    const scad = new Date(open);
    scad.setDate(scad.getDate() + 3);
    const fmt = (d: Date) => (Number.isNaN(d.getTime()) ? "--" : d.toLocaleDateString("it-IT"));
    return { open: fmt(open), scad: fmt(scad) };
  }, [dataApertura]);

  const cycleStato = (id: string) => {
    setTavoli((prev) =>
      prev.map((x) => {
        if (x.id !== id) return x;
        const order: StatoTavolo[] = ["libero", "occupato", "prenotato", "cancellato"];
        const next = order[(order.indexOf(x.stato) + 1) % order.length];
        return { ...x, stato: next };
      })
    );
  };

  return (
    <div className="min-h-screen bg-[#05070A] text-white relative overflow-hidden font-sans">
      <div className="absolute inset-0 bg-gradient-to-br from-[#00D9FF]/20 via-[#7B61FF]/20 to-[#05070A] blur-[80px]" />
      <div className="absolute top-0 left-0 w-[600px] h-[600px] bg-[#00D9FF]/30 rounded-full blur-[120px] -translate-x-1/2 -translate-y-1/2" />
      <div className="absolute bottom-0 right-0 w-[800px] h-[800px] bg-[#7B61FF]/30 rounded-full blur-[120px] translate-x-1/2 translate-y-1/2" />

      <header className="relative z-10 p-6 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-[#00D9FF] to-[#7B61FF] flex items-center justify-center shadow-[0_0_20px_#00D9FF]">🧠</div>
          <div>
            <h1 className="text-xl font-bold tracking-widest bg-gradient-to-r from-[#00D9FF] to-[#7B61FF] bg-clip-text text-transparent">MENTE LOCALE</h1>
            <p className="text-[10px] text-white/50 tracking-[0.3em]">RESTAURANT OS • LIVE</p>
          </div>
        </div>
        <div className="w-12 h-12 rounded-full border border-[#00D9FF]/50 bg-black/30 backdrop-blur flex items-center justify-center text-sm font-semibold">ML</div>
      </header>

      <main className="relative z-10 p-4 space-y-6 max-w-[480px] mx-auto">
        <AnimatePresence mode="wait">
          <motion.div key={tab} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.22 }} className="space-y-6">
            {(tab === "dashboard" || tab === "analisi") && (
              <motion.div className="rounded-[24px] border border-white/10 bg-white/[0.05] backdrop-blur-[20px] shadow-[inset_0_1px_1px_rgba(255,255,255,0.2),0_0_40px_rgba(0,217,255,0.15)] p-5 grid grid-cols-3 divide-x divide-white/10">
                <div className="pr-4">
                  <p className="text-[10px] text-[#00D9FF] uppercase">Occupazione</p>
                  <p className="text-4xl font-black text-[#00D9FF] drop-shadow-[0_0_10px_#00D9FF]">{occupazione}%</p>
                  <p className="text-xs text-white/60">{occupati}/{tavoli.length} tavoli</p>
                </div>
                <div className="px-4">
                  <p className="text-[10px] text-[#7B61FF] uppercase">Ricavi Oggi</p>
                  <p className="text-3xl font-black text-[#9B7FFF] drop-shadow-[0_0_10px_#7B61FF]">EUR 1240</p>
                  <p className="text-xs text-green-400">+12% vs ieri</p>
                </div>
                <div className="pl-4">
                  <p className="text-[10px] text-white/60 uppercase">Tempo medio</p>
                  <p className="text-4xl font-black">45min</p>
                  <p className="text-xs text-white/60">media servizio</p>
                </div>
              </motion.div>
            )}

            {(tab === "dashboard" || tab === "prenotazioni") && (
              <div>
                <div className="flex justify-between items-center mb-3">
                  <h2 className="font-bold text-lg">Prenotazioni</h2>
                  <button onClick={() => setTab("prenotazioni")} className="text-xs px-3 py-1 rounded-full border border-[#00D9FF] text-[#00D9FF] bg-[#00D9FF]/10">Vedi tutte</button>
                </div>
                <div className="space-y-3">
                  {(tab === "prenotazioni" ? PRENOTAZIONI : PRENOTAZIONI.slice(0, 3)).map((p) => (
                    <div key={p.nome} className="rounded-2xl bg-white/[0.06] border border-white/10 backdrop-blur p-4 flex justify-between items-center">
                      <div className="flex gap-3 items-center">
                        <div className={`w-10 h-10 rounded-full bg-gradient-to-br ${p.color === "cyan" ? "from-cyan-500 to-blue-500" : p.color === "gold" ? "from-yellow-500 to-orange-500" : "from-gray-600 to-gray-800"} flex items-center justify-center font-bold`}>{p.initials}</div>
                        <div>
                          <p className="font-bold flex gap-2 items-center">{p.nome}{p.vip && <span className="text-[10px] bg-yellow-500/20 text-yellow-400 px-2 py-0.5 rounded-full">VIP</span>}</p>
                          <p className="text-xs text-white/60">{p.dettagli}</p>
                        </div>
                      </div>
                      <span className={`text-xs px-3 py-1 rounded-full border ${p.stato === "Confermata" ? "border-cyan-400 text-cyan-400 bg-cyan-400/10" : p.stato === "VIP" ? "border-yellow-400 text-yellow-400 bg-yellow-400/10" : "border-red-400 text-red-400 bg-red-400/10"}`}>{p.stato}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {(tab === "dashboard" || tab === "tavoli") && (
              <div>
                <h2 className="font-bold text-lg mb-3 flex justify-between">Gestione Tavoli <span className="text-white/40 text-sm">tocca per ciclare</span></h2>
                <div className="grid grid-cols-2 gap-3">
                  {tavoli.map((t) => (
                    <motion.div key={t.id} whileTap={{ scale: 0.97 }} onClick={() => cycleStato(t.id)} className={`rounded-[20px] p-4 border backdrop-blur cursor-pointer transition-all ${statoClass(t.stato)}`}>
                      <p className="text-xs">• {t.nome}</p>
                      <p className="font-bold mt-1 capitalize text-white">{statoLabel(t)}</p>
                      <p className="text-xs text-white/60 mt-1">{t.tempo ? `${t.tempo} • ${t.cliente}` : t.stato === "libero" ? "Pronto" : "--"}</p>
                    </motion.div>
                  ))}
                </div>
              </div>
            )}

            {(tab === "dashboard" || tab === "tavoli") && (
              <div className="rounded-[24px] bg-black/40 border border-white/10 p-4">
                <div className="flex justify-between items-center mb-3">
                  <h3 className="font-bold">KDS CUCINA LIVE</h3>
                  <button onClick={() => playSound("nuovo")} className="text-xs bg-white/10 px-3 py-1 rounded-full">Test Suono</button>
                </div>
                <div className="space-y-2">
                  {kdsCucina.length === 0 && <p className="text-sm text-white/50 py-4 text-center">Cucina libera. Nessuna comanda aperta.</p>}
                  {kdsCucina.map((k) => (
                    <div key={k.id} className={`p-3 rounded-xl border-l-4 ${k.stato === "nuovo" ? "border-red-500 bg-red-500/10 animate-pulse" : "border-yellow-500 bg-yellow-500/10"}`}>
                      <div className="flex justify-between">
                        <p className="font-bold">{k.tavolo} - {k.piatti.map((p) => p.nome).join(", ")} x{k.piatti[0].qta}</p>
                        <p className="text-xs text-white/60">{k.ora} • {k.cameriere}</p>
                      </div>
                      {k.piatti[0].note && <p className="text-xs text-yellow-300 mt-1">{k.piatti[0].note}</p>}
                      <div className="flex gap-2 mt-2">
                        <button className="text-[10px] bg-[#00D9FF] text-black px-3 py-1 rounded-full font-bold" onClick={() => setKdsCucina((prev) => prev.map((x) => (x.id === k.id ? { ...x, stato: "in_prep" } : x)))}>IN PREP</button>
                        <button className="text-[10px] bg-green-500 text-black px-3 py-1 rounded-full font-bold" onClick={() => { setKdsCucina((prev) => prev.filter((x) => x.id !== k.id)); playSound("pronto"); }}>PRONTO Sala</button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {(tab === "dashboard" || tab === "haccp") && (
              <div className="rounded-[24px] bg-white/[0.05] border border-white/10 p-4">
                <h3 className="font-bold mb-3">HACCP PRO - Etichettatura</h3>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <input value={prodotto} onChange={(e) => setProdotto(e.target.value)} placeholder="Prodotto" className="bg-black/30 border border-white/10 rounded-xl p-3" />
                  <input value={lotto} onChange={(e) => setLotto(e.target.value)} placeholder="Lotto" className="bg-black/30 border border-white/10 rounded-xl p-3" />
                  <input type="date" value={dataApertura} onChange={(e) => setDataApertura(e.target.value)} className="bg-black/30 border border-white/10 rounded-xl p-3 col-span-2" />
                </div>
                <button className="w-full mt-3 bg-gradient-to-r from-[#00D9FF] to-[#7B61FF] rounded-xl py-3 font-bold text-black">Genera Etichetta 70x40 ZPL</button>
                <div className="mt-3 p-3 bg-white text-black rounded-xl text-[10px] font-mono">
                  <p className="uppercase font-bold">{prodotto || "PRODOTTO"}</p>
                  <p>Aperto: {labelPreview.open} - Scad: {labelPreview.scad}</p>
                  <p>Lotto: {lotto || "-"} - Op: Marco</p>
                  <p>QR: [######]</p>
                </div>
              </div>
            )}

            {tab === "magazzino" && (
              <div className="rounded-[24px] bg-white/[0.05] border border-white/10 p-4 space-y-3">
                <h3 className="font-bold">Magazzino</h3>
                {[{ nome: "Mozzarella fiordilatte", qta: "2.4 kg", soglia: "sotto scorta" }, { nome: "Guanciale", qta: "1.8 kg", soglia: "ok" }, { nome: "Pecorino romano", qta: "0.6 kg", soglia: "attenzione" }, { nome: "Pasta spaghetti", qta: "8 kg", soglia: "ok" }].map((item) => (
                  <div key={item.nome} className="flex justify-between items-center rounded-2xl bg-black/30 p-3 border border-white/10">
                    <div>
                      <p className="font-semibold">{item.nome}</p>
                      <p className="text-xs text-white/50">{item.qta}</p>
                    </div>
                    <span className={`text-[10px] px-2 py-1 rounded-full border ${item.soglia === "ok" ? "border-green-400 text-green-400" : item.soglia === "attenzione" ? "border-yellow-400 text-yellow-400" : "border-red-400 text-red-400"}`}>{item.soglia}</span>
                  </div>
                ))}
              </div>
            )}

            {tab === "analisi" && (
              <div className="rounded-[24px] bg-white/[0.05] border border-white/10 p-4 space-y-3">
                <h3 className="font-bold">Analisi serata</h3>
                <p className="text-sm text-white/70">Coperti stimati: 42. Ticket medio 29,50. Piatto top: Carbonara.</p>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="rounded-2xl bg-black/30 p-3 border border-white/10">
                    <p className="text-white/50 text-xs">Cucina</p>
                    <p className="font-bold text-[#00D9FF]">12 min / piatto</p>
                  </div>
                  <div className="rounded-2xl bg-black/30 p-3 border border-white/10">
                    <p className="text-white/50 text-xs">No-show</p>
                    <p className="font-bold text-yellow-300">1 prenotazione</p>
                  </div>
                </div>
              </div>
            )}

            <div className="rounded-[24px] bg-gradient-to-br from-[#7B61FF]/20 to-[#00D9FF]/20 border border-[#7B61FF]/30 p-4">
              <h3 className="font-bold">Mente Locale IA</h3>
              <p className="text-xs text-white/70 mt-2">{iaOk ? "Ordine inviato a Rossi. 4kg di mozzarella in arrivo venerdi mattina." : "Sergio, per sabato hai 18 prenotati, ti servono 4kg di mozzarella in piu. Vuoi che ordini da Rossi?"}</p>
              {!iaOk && (
                <div className="flex gap-2 mt-3">
                  <button onClick={() => setIaOk(true)} className="text-xs bg-white text-black px-4 py-2 rounded-full font-bold">Si, ordina</button>
                  <button className="text-xs border border-white/20 px-4 py-2 rounded-full">Dimmi di piu</button>
                </div>
              )}
            </div>
          </motion.div>
        </AnimatePresence>
      </main>

      <nav className="fixed bottom-4 left-4 right-4 max-w-[480px] mx-auto bg-black/60 backdrop-blur-[20px] border border-white/10 rounded-[24px] p-2 flex justify-around z-20">
        {NAV.map((n) => (
          <button key={n.label} onClick={() => setTab(n.id)} className={`flex flex-col items-center p-2 rounded-2xl ${tab === n.id ? "text-[#00D9FF] bg-[#00D9FF]/10" : "text-white/50"}`}>
            <span>{n.icon}</span>
            <span className="text-[9px] mt-1">{n.label}</span>
          </button>
        ))}
      </nav>

      <div className="h-24" />
    </div>
  );
}
