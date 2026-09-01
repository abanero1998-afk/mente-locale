"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { JobOffline, Ordine, Piatto, StatoOrdine, SyncEvent, Tavolo } from "./types";
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

type Store = {
  tavoli: Tavolo[];
  codaOffline: JobOffline[];
  online: boolean;
  hydrated: boolean;
  setOnline: (v: boolean) => void;
  applicaEvento: (e: SyncEvent) => void;
  pulse: (id: number) => void;
  aggiungiOrdine: (tavoloId: number, piatto: Piatto) => Promise<Ordine>;
  setOrdineStato: (ordineId: string, stato: StatoOrdine) => Promise<void>;
  chiudiTavolo: (id: number) => Promise<void>;
  syncCoda: () => Promise<void>;
};

function enqueue(job: JobOffline) {
  void codaPut(job);
}

export const useMenteStore = create<Store>()(
  persist(
    (set, get) => ({
      tavoli: makeTavoli(),
      codaOffline: [],
      online: typeof navigator === "undefined" ? true : navigator.onLine,
      hydrated: false,
      setOnline: (v) => set({ online: v }),
      pulse: (id) => {
        set((s) => ({ tavoli: s.tavoli.map((t) => (t.id === id ? { ...t, animazione: "pulse" } : t)) }));
        setTimeout(() => {
          set((s) => ({ tavoli: s.tavoli.map((t) => (t.id === id ? { ...t, animazione: "none" } : t)) }));
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
        publishLocal(ev);
        if (typeof navigator !== "undefined" && !navigator.onLine) {
          const job: JobOffline = { id: ordine.id, tipo: "ordine", tavoloId, piatto, ordine, ts: Date.now() };
          enqueue(job);
          set((s) => ({ codaOffline: [...s.codaOffline, job] }));
          return ordine;
        }
        if (supabaseConfigured()) {
          const ok = await publishRemote(ev);
          if (!ok) {
            const job: JobOffline = { id: ordine.id, tipo: "ordine", tavoloId, piatto, ordine, ts: Date.now() };
            enqueue(job);
            set((s) => ({ codaOffline: [...s.codaOffline, job] }));
          }
        }
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
        publishLocal(ev);
        if (typeof navigator !== "undefined" && !navigator.onLine) {
          const job: JobOffline = { id: `st-${ordineId}-${Date.now()}`, tipo: "stato", tavoloId: 0, ordineId, stato, ts: Date.now() };
          enqueue(job);
          set((s) => ({ codaOffline: [...s.codaOffline, job] }));
          return;
        }
        if (supabaseConfigured()) {
          const ok = await publishRemote(ev);
          if (!ok) {
            const job: JobOffline = { id: `st-${ordineId}-${Date.now()}`, tipo: "stato", tavoloId: 0, ordineId, stato, ts: Date.now() };
            enqueue(job);
            set((s) => ({ codaOffline: [...s.codaOffline, job] }));
          }
        }
      },
      chiudiTavolo: async (id) => {
        set((s) => ({
          tavoli: s.tavoli.map((t) => (t.id === id ? { ...t, stato: "libero", ordini: [], animazione: "none" } : t)),
        }));
        const ev: SyncEvent = { kind: "chiudi_tavolo", tavoloId: id, deviceId };
        publishLocal(ev);
        if (typeof navigator !== "undefined" && !navigator.onLine) {
          const job: JobOffline = { id: `cl-${id}-${Date.now()}`, tipo: "chiudi", tavoloId: id, ts: Date.now() };
          enqueue(job);
          set((s) => ({ codaOffline: [...s.codaOffline, job] }));
          return;
        }
        if (supabaseConfigured()) {
          const ok = await publishRemote(ev);
          if (!ok) {
            const job: JobOffline = { id: `cl-${id}-${Date.now()}`, tipo: "chiudi", tavoloId: id, ts: Date.now() };
            enqueue(job);
            set((s) => ({ codaOffline: [...s.codaOffline, job] }));
          }
        }
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
          if (!ev) continue;
          publishLocal(ev);
          const ok = await publishRemote(ev);
          if (!ok) left.push(job);
        }
        if (left.length === 0) await codaClear().catch(() => {});
        set({ codaOffline: left });
      },
    }),
    { name: "mente-locale-v2" }
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
