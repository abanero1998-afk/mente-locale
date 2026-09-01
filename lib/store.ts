"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type {
  ArticoloMagazzino,
  Frigo,
  JobOffline,
  Ordine,
  Piatto,
  Prenotazione,
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
    posti: [2, 2, 4, 4, 6, 8][i % 6],
    stato: stati[i % 5],
    x: 10 + (i % 5) * 18 + 5,
    y: 14 + Math.floor(i / 5) * 22,
    clienti: [2, 2, 4, 3, 5, 6][i % 6],
    cameriere: ["Luca", "Sara", "Marco"][i % 3],
    tempo: (i * 7) % 60,
    ordini: [],
    animazione: "none" as const,
  }));
}

const MENU_SEED: Piatto[] = [
  { id: "1", nome: "Carbonara", prezzo: 16, reparto: "cucina", categoria: "Primi", img: "🍝" },
  { id: "2", nome: "Tagliata", prezzo: 28, reparto: "cucina", categoria: "Secondi", img: "🥩" },
  { id: "3", nome: "Negroni", prezzo: 10, reparto: "bar", categoria: "Cocktail", img: "🍸" },
  { id: "4", nome: "Tiramisu", prezzo: 8, reparto: "cucina", categoria: "Dolci", img: "🍰" },
  { id: "5", nome: "Spritz", prezzo: 9, reparto: "bar", categoria: "Cocktail", img: "🍹" },
  { id: "6", nome: "Cacio Pepe", prezzo: 15, reparto: "cucina", categoria: "Primi", img: "🧀" },
];

const MAG_SEED: ArticoloMagazzino[] = [
  { id: "m1", nome: "Mozzarella fiordilatte", qta: 2.4, unita: "kg", soglia: 4 },
  { id: "m2", nome: "Guanciale", qta: 1.8, unita: "kg", soglia: 1 },
  { id: "m3", nome: "Pecorino romano", qta: 0.6, unita: "kg", soglia: 1 },
  { id: "m4", nome: "Pasta spaghetti", qta: 8, unita: "kg", soglia: 3 },
];

const FRIGO_SEED: Frigo[] = [
  { id: "f1", nome: "Frigo A", temp: 6.8, min: 0, max: 4 },
  { id: "f2", nome: "Frigo B", temp: 2.1, min: 0, max: 4 },
  { id: "f3", nome: "Frigo C", temp: 8.4, min: 0, max: 4 },
  { id: "f4", nome: "Cella", temp: 3.2, min: 0, max: 4 },
];

const PREN_SEED: Prenotazione[] = [
  { id: "p1", initials: "MR", nome: "Mario Rossi", persone: 4, tavolo: "T03", quando: "Oggi 20:30", stato: "confermata", fonte: "telefono" },
  { id: "p2", initials: "CB", nome: "Caterina Bianchi", persone: 2, tavolo: "T01", quando: "Oggi 21:00", stato: "vip", fonte: "telefono" },
  { id: "p3", initials: "LV", nome: "Luca Verdi", persone: 6, tavolo: "T08", quando: "Oggi 19:00", stato: "cancellata", fonte: "walkin" },
  { id: "p4", initials: "AN", nome: "Anna Neri", persone: 2, tavolo: "T12", quando: "Oggi 20:00", stato: "confermata", fonte: "telefono" },
  { id: "p5", initials: "GS", nome: "Giulia Sanna", persone: 3, tavolo: "T05", quando: "Oggi 20:15", stato: "da_confermare", fonte: "whatsapp" },
  { id: "p6", initials: "FM", nome: "Fabio Moretti", persone: 5, tavolo: "T10", quando: "Oggi 21:30", stato: "da_confermare", fonte: "whatsapp" },
];

type Store = {
  tavoli: Tavolo[];
  menu: Piatto[];
  magazzino: ArticoloMagazzino[];
  frighi: Frigo[];
  prenotazioni: Prenotazione[];
  scontrini: Scontrino[];
  codaOffline: JobOffline[];
  online: boolean;
  hydrated: boolean;
  setOnline: (v: boolean) => void;
  applicaEvento: (e: SyncEvent) => void;
  pulse: (id: number) => void;
  aggiungiOrdine: (tavoloId: number, piatto: Piatto) => Promise<Ordine>;
  setOrdineStato: (ordineId: string, stato: StatoOrdine) => Promise<void>;
  chiudiTavolo: (id: number) => Promise<void>;
  aggiungiProdotto: (form: { nome: string; prezzo: string; categoria: string; reparto: Piatto["reparto"]; img: string }) => Promise<Piatto>;
  eliminaProdotto: (id: string) => Promise<void>;
  confermaPrenotazione: (id: string) => void;
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
      prenotazioni: PREN_SEED,
      scontrini: [
        { id: "s1", tavoloId: 4, totale: 86, minuti: 42, ts: Date.now() - 3600000 },
        { id: "s2", tavoloId: 7, totale: 124, minuti: 51, ts: Date.now() - 1800000 },
        { id: "s3", tavoloId: 11, totale: 58, minuti: 38, ts: Date.now() - 900000 },
      ],
      codaOffline: [],
      online: typeof navigator === "undefined" ? true : navigator.onLine,
      hydrated: false,
      setOnline: (v) => set({ online: v }),
      pulse: (id) => {
        set((s) => ({
          tavoli: s.tavoli.map((t) => (t.id === id ? { ...t, animazione: "pulse" } : t)),
        }));
        setTimeout(() => {
          set((s) => ({
            tavoli: s.tavoli.map((t) => (t.id === id ? { ...t, animazione: "none" } : t)),
          }));
        }, 2000);
      },
      applicaEvento: (e) => {
        if (e.kind === "nuovo_ordine") {
          set((s) => ({
            tavoli: s.tavoli.map((t) =>
              t.id === e.tavoloId
                ? {
                    ...t,
                    stato: "occupato",
                    animazione: "pulse",
                    ordini: t.ordini.some((o) => o.id === e.ordine.id) ? t.ordini : [...t.ordini, e.ordine],
                  }
                : t
            ),
          }));
          get().pulse(e.tavoloId);
        }
        if (e.kind === "stato_ordine") {
          set((s) => ({
            tavoli: s.tavoli.map((t) => ({
              ...t,
              ordini: t.ordini.map((o) => (o.id === e.ordineId ? { ...o, stato: e.stato } : o)),
            })),
          }));
        }
        if (e.kind === "chiudi_tavolo") {
          set((s) => ({
            tavoli: s.tavoli.map((t) =>
              t.id === e.tavoloId ? { ...t, stato: "libero", ordini: [], animazione: "none" } : t
            ),
          }));
        }
        if (e.kind === "prodotto_add") {
          set((s) => ({
            menu: s.menu.some((p) => p.id === e.piatto.id) ? s.menu : [...s.menu, e.piatto],
          }));
        }
        if (e.kind === "prodotto_del") {
          set((s) => ({ menu: s.menu.filter((p) => p.id !== e.prodottoId) }));
        }
      },
      aggiungiOrdine: async (tavoloId, piatto) => {
        const ordine: Ordine = {
          id: `${Date.now()}-${piatto.id}-${Math.random().toString(36).slice(2, 6)}`,
          piatto,
          qta: 1,
          stato: "ordinato",
          ora: new Date().toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" }),
        };
        set((s) => ({
          tavoli: s.tavoli.map((t) =>
            t.id === tavoloId ? { ...t, ordini: [...t.ordini, ordine], stato: "occupato", animazione: "pulse" } : t
          ),
        }));
        get().pulse(tavoloId);
        const ev: SyncEvent = { kind: "nuovo_ordine", tavoloId, ordine, deviceId };
        await pushEvent(ev, { id: ordine.id, tipo: "ordine", tavoloId, piatto, ordine, ts: Date.now() }, set);
        return ordine;
      },
      setOrdineStato: async (ordineId, stato) => {
        set((s) => ({
          tavoli: s.tavoli.map((t) => ({
            ...t,
            ordini: t.ordini.map((o) => (o.id === ordineId ? { ...o, stato } : o)),
          })),
        }));
        const ev: SyncEvent = { kind: "stato_ordine", ordineId, stato, deviceId };
        await pushEvent(ev, { id: `st-${ordineId}-${Date.now()}`, tipo: "stato", tavoloId: 0, ordineId, stato, ts: Date.now() }, set);
      },
      chiudiTavolo: async (id) => {
        const tav = get().tavoli.find((t) => t.id === id);
        const totale = tav ? tav.ordini.reduce((s, o) => s + o.piatto.prezzo * o.qta, 0) : 0;
        const minuti = tav?.tempo || 45;
        set((s) => ({
          tavoli: s.tavoli.map((t) => (t.id === id ? { ...t, stato: "libero", ordini: [], animazione: "none" } : t)),
          scontrini: [...s.scontrini, { id: `sc-${id}-${Date.now()}`, tavoloId: id, totale, minuti, ts: Date.now() }],
        }));
        const ev: SyncEvent = { kind: "chiudi_tavolo", tavoloId: id, deviceId };
        await pushEvent(ev, { id: `cl-${id}-${Date.now()}`, tipo: "chiudi", tavoloId: id, ts: Date.now() }, set);
      },
      aggiungiProdotto: async (form) => {
        const piatto: Piatto = {
          id: `p-${Date.now()}`,
          nome: form.nome.trim() || "Nuovo piatto",
          prezzo: Number(form.prezzo) || 0,
          categoria: form.categoria || "Primi",
          reparto: form.reparto || "cucina",
          img: form.img || "🍝",
        };
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
      confermaPrenotazione: (id) => {
        set((s) => ({
          prenotazioni: s.prenotazioni.map((p) => (p.id === id ? { ...p, stato: "confermata" } : p)),
        }));
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
    { name: "mente-locale-v3" }
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
    if (navigator.onLine && useMenteStore.getState().codaOffline.length) {
      void useMenteStore.getState().syncCoda();
    }
  }, 5000);
}
