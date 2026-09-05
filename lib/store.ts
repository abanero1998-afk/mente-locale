"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type {
  ArticoloMagazzino,
  AvvisoSocio,
  Frigo,
  JobOffline,
  LogTemp,
  Lotto,
  Ordine,
  Piatto,
  Prenotazione,
  PrinterConfig,
  Pulizia,
  Scontrino,
  StatoOrdine,
  SyncEvent,
  Tavolo,
} from "./types";
import { codaAll, codaClear, codaPut } from "./idb-queue";
import { deviceId, listenLocal, listenRemote, publishLocal, publishRemote, supabaseConfigured } from "./sync";

function makeTavoli(): Tavolo[] {
  const stati: Tavolo["stato"][] = ["libero", "libero", "occupato", "prenotato", "libero"];
  return Array.from({ length: 20 }, (_, i) => ({
    id: i + 1,
    nome: `T${String(i + 1).padStart(2, "0")}`,
    salaId: i < 12 ? "sala-int" : "sala-est",
    posti: [2, 2, 4, 4, 6, 8][i % 6],
    stato: stati[i % 5],
    x: 10 + (i % 5) * 18 + 5,
    y: 14 + Math.floor(i / 5) * 22,
    clienti: [2, 2, 4, 3, 5, 6][i % 6],
    cameriere: ["Luca", "Sara", "Marco"][i % 3],
    tempo: i === 2 ? 73 : (i * 7) % 60,
    ordini: [],
    animazione: "none" as const,
  }));
}

const MENU_SEED: Piatto[] = [
  { id: "1", nome: "Carbonara", prezzo: 16, reparto: "cucina", categoria: "Primi", img: "https://images.unsplash.com/photo-1612874742237-6526221588e3?w=400&h=300&fit=crop" },
  { id: "2", nome: "Cacio e Pepe", prezzo: 15, reparto: "cucina", categoria: "Primi", img: "https://images.unsplash.com/photo-1621996346565-e3dbc646d9a9?w=400&h=300&fit=crop" },
  { id: "3", nome: "Tagliata di manzo", prezzo: 28, reparto: "cucina", categoria: "Secondi", img: "https://images.unsplash.com/photo-1600891964092-4316c288032e?w=400&h=300&fit=crop" },
  { id: "4", nome: "Branzino al forno", prezzo: 24, reparto: "cucina", categoria: "Secondi", img: "https://images.unsplash.com/photo-1519708227418-c8fd9a32b7a2?w=400&h=300&fit=crop" },
  { id: "5", nome: "Patate al forno", prezzo: 6, reparto: "cucina", categoria: "Contorni", img: "https://images.unsplash.com/photo-1518013431117-eb1465fa5752?w=400&h=300&fit=crop" },
  { id: "6", nome: "Insalata mista", prezzo: 7, reparto: "cucina", categoria: "Contorni", img: "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=400&h=300&fit=crop" },
  { id: "7", nome: "Tiramisù", prezzo: 8, reparto: "cucina", categoria: "Dolci", img: "https://images.unsplash.com/photo-1571877227200-a0d98ea607e9?w=400&h=300&fit=crop" },
  { id: "8", nome: "Panna cotta", prezzo: 7, reparto: "cucina", categoria: "Dolci", img: "https://images.unsplash.com/photo-1488477181946-6428a0291777?w=400&h=300&fit=crop" },
  { id: "9", nome: "Acqua naturale", prezzo: 3, reparto: "bar", categoria: "Bevande", img: "https://images.unsplash.com/photo-1548839140-29a749e1cf4d?w=400&h=300&fit=crop" },
  { id: "10", nome: "Spritz", prezzo: 9, reparto: "bar", categoria: "Bevande", img: "https://images.unsplash.com/photo-1551024709-8f23befc6f87?w=400&h=300&fit=crop" },
  { id: "11", nome: "Negroni", prezzo: 10, reparto: "bar", categoria: "Bevande", img: "https://images.unsplash.com/photo-1514362545857-3bc16c4c7d1b?w=400&h=300&fit=crop" },
  { id: "12", nome: "Chianti Classico", prezzo: 28, reparto: "bar", categoria: "Vini", img: "https://images.unsplash.com/photo-1510812431401-41d2bd2722f3?w=400&h=300&fit=crop" },
  { id: "13", nome: "Vermentino", prezzo: 22, reparto: "bar", categoria: "Vini", img: "https://images.unsplash.com/photo-1569529465841-dfecdab7503b?w=400&h=300&fit=crop" },
];

const MAG_SEED: ArticoloMagazzino[] = [
  { id: "m1", nome: "Mozzarella fiordilatte", qta: 2.4, unita: "kg", soglia: 4 },
  { id: "m2", nome: "Guanciale", qta: 1.8, unita: "kg", soglia: 1 },
  { id: "m3", nome: "Pecorino romano", qta: 0.6, unita: "kg", soglia: 1 },
  { id: "m4", nome: "Pasta spaghetti", qta: 8, unita: "kg", soglia: 3 },
];

const FRIGO_SEED: Frigo[] = [
  { id: "f1", nome: "Frigo Carne", temp: 2, min: 0, max: 4, lastCheck: 0 },
  { id: "f2", nome: "Frigo Latticini", temp: 3, min: 0, max: 4, lastCheck: 0 },
  { id: "f3", nome: "Cella", temp: -18, min: -22, max: -16, lastCheck: 0 },
];

export function giorniRimasti(scadenza: string) {
  const d = new Date(scadenza);
  if (Number.isNaN(d.getTime())) return 0;
  return Math.ceil((d.getTime() - Date.now()) / 86400000);
}

const LOTTI_SEED: Lotto[] = [
  { id: "l1", prodotto: "Mozzarella fiordilatte", lotto: "L12345", apertura: "2026-09-01", scadenza: "2026-09-04", giorni_rimasti: giorniRimasti("2026-09-04"), operatore: "Marco" },
  { id: "l2", prodotto: "Guanciale", lotto: "L8891", apertura: "2026-09-02", scadenza: "2026-09-09", giorni_rimasti: giorniRimasti("2026-09-09"), operatore: "Sara" },
];

const PULIZIA_SEED: Pulizia[] = [
  { id: "c1", zona: "Cucina pavimento", operatore: "Marco", fatto: false, ts: Date.now(), note: "Fine servizio" },
  { id: "c2", zona: "Bagni", operatore: "Sara", fatto: true, ts: Date.now() - 3600000, note: "Ore 18" },
  { id: "c3", zona: "Sala tavoli", operatore: "Luca", fatto: false, ts: Date.now(), note: "" },
];

const PRINTER_SEED: PrinterConfig = {
  mode: "zpl",
  ip: "192.168.1.80",
  port: "9100",
  btName: "Zebra-ZQ520",
  httpsUrl: "",
};

type Store = {
  tavoli: Tavolo[];
  menu: Piatto[];
  magazzino: ArticoloMagazzino[];
  frighi: Frigo[];
  lotti: Lotto[];
  logTemp: LogTemp[];
  pulizie: Pulizia[];
  printer: PrinterConfig;
  prenotazioni: Prenotazione[];
  scontrini: Scontrino[];
  avvisi: AvvisoSocio[];
  codaOffline: JobOffline[];
  online: boolean;
  hydrated: boolean;
  setOnline: (v: boolean) => void;
  applicaEvento: (e: SyncEvent) => void;
  pulse: (id: number) => void;
  aggiungiOrdine: (tavoloId: number, piatto: Piatto, qta?: number, note?: string) => Promise<Ordine>;
  setOrdineStato: (ordineId: string, stato: StatoOrdine) => Promise<void>;
  chiudiTavolo: (id: number) => Promise<void>;
  aggiungiProdotto: (form: { nome: string; prezzo: string; categoria: string; reparto: Piatto["reparto"]; img: string }) => Promise<Piatto>;
  eliminaProdotto: (id: string) => Promise<void>;
  confermaPrenotazione: (id: string) => void;
  creaLotto: (form: { prodotto: string; lotto: string; scadenza: string; operatore?: string; note?: string; produzione?: string }) => void;
  updateLotto: (id: string, patch: Partial<Lotto>) => void;
  deleteLotto: (id: string) => void;
  addMag: (form: { nome: string; qta: string; unita: string; soglia: string }) => void;
  updateMag: (id: string, patch: Partial<ArticoloMagazzino>) => void;
  deleteMag: (id: string) => void;
  addFrigo: (form: { nome: string; temp: string; min: string; max: string }) => void;
  updateFrigo: (id: string, patch: Partial<Frigo>) => void;
  deleteFrigo: (id: string) => void;
  salvaTemp: (frigoId: string, temp: number) => void;
  confermaTemp: (frigoId: string) => void;
  addPulizia: (form: { zona: string; operatore: string; note: string }) => void;
  togglePulizia: (id: string) => void;
  deletePulizia: (id: string) => void;
  setPrinter: (patch: Partial<PrinterConfig>) => void;
  pushAvviso: (msg: string, urgente?: boolean) => void;
  syncCoda: () => Promise<void>;
};

function enqueue(job: JobOffline) {
  void codaPut(job);
}

async function pushEvent(ev: SyncEvent, job: JobOffline, set: (fn: (s: Store) => Partial<Store>) => void) {
  publishLocal(ev);
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    enqueue(job);
    set((s) => ({ codaOffline: [...s.codaOffline, job] }));
    return;
  }
  if (supabaseConfigured()) {
    const ok = await publishRemote(ev);
    if (!ok) {
      enqueue(job);
      set((s) => ({ codaOffline: [...s.codaOffline, job] }));
    }
  }
}

export const useMenteStore = create<Store>()(
  persist(
    (set, get) => ({
      tavoli: makeTavoli(),
      menu: MENU_SEED,
      magazzino: MAG_SEED,
      frighi: FRIGO_SEED,
      lotti: LOTTI_SEED,
      logTemp: [],
      pulizie: PULIZIA_SEED,
      printer: PRINTER_SEED,
      prenotazioni: [{ id: "p1", initials: "MR", nome: "Mario Rossi", persone: 4, tavolo: "T03", quando: "Oggi 20:30", stato: "confermata", fonte: "telefono" }],
      scontrini: [
        { id: "s1", tavoloId: 4, totale: 86, minuti: 42, ts: Date.now() - 3600000 },
        { id: "s2", tavoloId: 7, totale: 124, minuti: 51, ts: Date.now() - 1800000 },
      ],
      avvisi: [],
      codaOffline: [],
      online: typeof navigator === "undefined" ? true : navigator.onLine,
      hydrated: false,
      setOnline: (v) => set({ online: v }),
      pulse: (id) => {
        set((s) => ({ tavoli: s.tavoli.map((t) => (t.id === id ? { ...t, animazione: "pulse" } : t)) }));
        setTimeout(() => set((s) => ({ tavoli: s.tavoli.map((t) => (t.id === id ? { ...t, animazione: "none" } : t)) })), 2000);
      },
      applicaEvento: (e) => {
        if (e.kind === "nuovo_ordine") {
          set((s) => ({
            tavoli: s.tavoli.map((t) =>
              t.id === e.tavoloId ? { ...t, stato: "occupato", animazione: "pulse", ordini: t.ordini.some((o) => o.id === e.ordine.id) ? t.ordini : [...t.ordini, e.ordine] } : t
            ),
          }));
          get().pulse(e.tavoloId);
        }
        if (e.kind === "stato_ordine") set((s) => ({ tavoli: s.tavoli.map((t) => ({ ...t, ordini: t.ordini.map((o) => (o.id === e.ordineId ? { ...o, stato: e.stato } : o)) })) }));
        if (e.kind === "chiudi_tavolo") set((s) => ({ tavoli: s.tavoli.map((t) => (t.id === e.tavoloId ? { ...t, stato: "libero", ordini: [], animazione: "none" } : t)) }));
        if (e.kind === "prodotto_add") set((s) => ({ menu: s.menu.some((p) => p.id === e.piatto.id) ? s.menu : [...s.menu, e.piatto] }));
        if (e.kind === "prodotto_del") set((s) => ({ menu: s.menu.filter((p) => p.id !== e.prodottoId) }));
        if (e.kind === "avviso_socio") get().pushAvviso(e.msg, e.urgente);
      },
      aggiungiOrdine: async (tavoloId, piatto, qta = 1, note) => {
        const ordine: Ordine = { id: `${Date.now()}-${piatto.id}-${Math.random().toString(36).slice(2, 6)}`, piatto, qta, note: note?.trim() || undefined, stato: "ordinato", ora: new Date().toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" }) };
        set((s) => ({ tavoli: s.tavoli.map((t) => (t.id === tavoloId ? { ...t, ordini: [...t.ordini, ordine], stato: "occupato", animazione: "pulse" } : t)) }));
        get().pulse(tavoloId);
        const ev: SyncEvent = { kind: "nuovo_ordine", tavoloId, ordine, deviceId };
        await pushEvent(ev, { id: ordine.id, tipo: "ordine", tavoloId, piatto, ordine, ts: Date.now() }, set);
        return ordine;
      },
      setOrdineStato: async (ordineId, stato) => {
        set((s) => ({ tavoli: s.tavoli.map((t) => ({ ...t, ordini: t.ordini.map((o) => (o.id === ordineId ? { ...o, stato } : o)) })) }));
        const ev: SyncEvent = { kind: "stato_ordine", ordineId, stato, deviceId };
        await pushEvent(ev, { id: `st-${ordineId}-${Date.now()}`, tipo: "stato", tavoloId: 0, ordineId, stato, ts: Date.now() }, set);
      },
      chiudiTavolo: async (id) => {
        const tav = get().tavoli.find((t) => t.id === id);
        const totale = tav ? tav.ordini.reduce((s, o) => s + o.piatto.prezzo * o.qta, 0) : 0;
        set((s) => ({
          tavoli: s.tavoli.map((t) => (t.id === id ? { ...t, stato: "libero", ordini: [], animazione: "none" } : t)),
          scontrini: [...s.scontrini, { id: `sc-${id}-${Date.now()}`, tavoloId: id, totale, minuti: tav?.tempo || 45, ts: Date.now() }],
        }));
        const ev: SyncEvent = { kind: "chiudi_tavolo", tavoloId: id, deviceId };
        await pushEvent(ev, { id: `cl-${id}-${Date.now()}`, tipo: "chiudi", tavoloId: id, ts: Date.now() }, set);
      },
      aggiungiProdotto: async (form) => {
        const piatto: Piatto = { id: `p-${Date.now()}`, nome: form.nome.trim() || "Nuovo piatto", prezzo: Number(form.prezzo) || 0, categoria: form.categoria || "Primi", reparto: form.reparto || "cucina", img: form.img.trim() || "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400&h=300&fit=crop" };
        set((s) => ({ menu: [...s.menu, piatto] }));
        const ev: SyncEvent = { kind: "prodotto_add", piatto, deviceId };
        await pushEvent(ev, { id: piatto.id, tipo: "prodotto_add", tavoloId: 0, piatto, ts: Date.now() }, set);
        return piatto;
      },
      eliminaProdotto: async (id) => {
        set((s) => ({ menu: s.menu.filter((p) => p.id !== id) }));
        const ev: SyncEvent = { kind: "prodotto_del", prodottoId: id, deviceId };
        await pushEvent(ev, { id: `pd-${id}`, tipo: "prodotto_del", tavoloId: 0, prodottoId: id, ts: Date.now() }, set);
      },
      confermaPrenotazione: (id) => set((s) => ({ prenotazioni: s.prenotazioni.map((p) => (p.id === id ? { ...p, stato: "confermata" } : p)) })),
      creaLotto: (form) => {
        const oggi = new Date().toISOString().slice(0, 10);
        set((s) => ({
          lotti: [{
            id: `lt-${Date.now()}`,
            prodotto: form.prodotto.trim() || "Prodotto",
            lotto: form.lotto.trim() || `L${Date.now().toString().slice(-5)}`,
            apertura: form.produzione || oggi,
            scadenza: form.scadenza || oggi,
            giorni_rimasti: giorniRimasti(form.scadenza || oggi),
            operatore: form.operatore || "Sala",
            note: form.note || "",
            produzione: form.produzione || oggi,
          }, ...s.lotti],
        }));
      },
      updateLotto: (id, patch) => set((s) => ({ lotti: s.lotti.map((l) => (l.id === id ? { ...l, ...patch, giorni_rimasti: giorniRimasti(patch.scadenza || l.scadenza) } : l)) })),
      deleteLotto: (id) => set((s) => ({ lotti: s.lotti.filter((l) => l.id !== id) })),
      addMag: (form) => set((s) => ({ magazzino: [...s.magazzino, { id: `m-${Date.now()}`, nome: form.nome || "Articolo", qta: Number(form.qta) || 0, unita: form.unita || "kg", soglia: Number(form.soglia) || 1 }] })),
      updateMag: (id, patch) => set((s) => ({ magazzino: s.magazzino.map((m) => (m.id === id ? { ...m, ...patch } : m)) })),
      deleteMag: (id) => set((s) => ({ magazzino: s.magazzino.filter((m) => m.id !== id) })),
      addFrigo: (form) => set((s) => ({ frighi: [...s.frighi, { id: `f-${Date.now()}`, nome: form.nome || "Frigo", temp: Number(form.temp) || 0, min: Number(form.min) || 0, max: Number(form.max) || 4, lastCheck: 0 }] })),
      updateFrigo: (id, patch) => set((s) => ({ frighi: s.frighi.map((f) => (f.id === id ? { ...f, ...patch } : f)) })),
      deleteFrigo: (id) => set((s) => ({ frighi: s.frighi.filter((f) => f.id !== id) })),
      salvaTemp: (frigoId, temp) => {
        const f = get().frighi.find((x) => x.id === frigoId);
        if (!f) return;
        set((s) => ({
          frighi: s.frighi.map((x) => (x.id === frigoId ? { ...x, temp, lastCheck: Date.now() } : x)),
          logTemp: [{ id: `t-${Date.now()}`, frigoId, nome: f.nome, temp, ts: Date.now(), operatore: "Sala" }, ...s.logTemp].slice(0, 200),
        }));
      },
      confermaTemp: (frigoId) => {
        const f = get().frighi.find((x) => x.id === frigoId);
        if (!f) return;
        get().salvaTemp(frigoId, f.temp);
      },
      addPulizia: (form) => set((s) => ({ pulizie: [{ id: `c-${Date.now()}`, zona: form.zona || "Zona", operatore: form.operatore || "Sala", fatto: false, ts: Date.now(), note: form.note || "" }, ...s.pulizie] })),
      togglePulizia: (id) => set((s) => ({ pulizie: s.pulizie.map((p) => (p.id === id ? { ...p, fatto: !p.fatto, ts: Date.now() } : p)) })),
      deletePulizia: (id) => set((s) => ({ pulizie: s.pulizie.filter((p) => p.id !== id) })),
      setPrinter: (patch) => set((s) => ({ printer: { ...s.printer, ...patch } })),
      pushAvviso: (msg, urgente = false) => {
        set((s) => {
          if (s.avvisi[0]?.msg === msg && Date.now() - s.avvisi[0].ts < 20000) return s;
          return { avvisi: [{ id: `ia-${Date.now()}`, msg, urgente, ts: Date.now() }, ...s.avvisi].slice(0, 20) };
        });
      },
      syncCoda: async () => {
        const fromIdb = await codaAll().catch(() => get().codaOffline);
        const jobs = fromIdb.length ? fromIdb : get().codaOffline;
        const left: JobOffline[] = [];
        for (const job of jobs) {
          let ev: SyncEvent | null = null;
          if (job.tipo === "ordine" && job.ordine) ev = { kind: "nuovo_ordine", tavoloId: job.tavoloId, ordine: job.ordine, deviceId };
          else if (job.tipo === "stato" && job.ordineId && job.stato) ev = { kind: "stato_ordine", ordineId: job.ordineId, stato: job.stato, deviceId };
          else if (job.tipo === "chiudi") ev = { kind: "chiudi_tavolo", tavoloId: job.tavoloId, deviceId };
          else if (job.tipo === "prodotto_add" && job.piatto) ev = { kind: "prodotto_add", piatto: job.piatto, deviceId };
          else if (job.tipo === "prodotto_del" && job.prodottoId) ev = { kind: "prodotto_del", prodottoId: job.prodottoId, deviceId };
          if (!ev) continue;
          publishLocal(ev);
          const ok = supabaseConfigured() ? await publishRemote(ev) : true;
          if (!ok) left.push(job);
        }
        if (left.length === 0) await codaClear().catch(() => {});
        set({ codaOffline: left });
      },
    }),
    { name: "mente-locale-v7" }
  )
);

let wired = false;
export function wireSync() {
  if (wired || typeof window === "undefined") return;
  wired = true;
  useMenteStore.setState({ online: navigator.onLine, hydrated: true });
  listenLocal((e) => useMenteStore.getState().applicaEvento(e));
  void listenRemote((e) => useMenteStore.getState().applicaEvento(e));
  window.addEventListener("online", () => {
    useMenteStore.setState({ online: true });
    void useMenteStore.getState().syncCoda();
  });
  window.addEventListener("offline", () => useMenteStore.setState({ online: false }));
  setInterval(() => {
    if (navigator.onLine && useMenteStore.getState().codaOffline.length) void useMenteStore.getState().syncCoda();
  }, 5000);
}
