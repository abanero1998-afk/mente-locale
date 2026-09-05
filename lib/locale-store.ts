"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { scopedStorage } from "./scoped-storage";
import type { Abbattimento, ControlloOlio, Fornitore, Postazione, Sala } from "./types";
import { useMenteStore } from "./store";

const SALE_SEED: Sala[] = [
  { id: "sala-int", nome: "Sala interna", tipo: "interna" },
  { id: "sala-est", nome: "Sala esterna", tipo: "esterna" },
];

type Locale = {
  postazione: Postazione | null;
  sale: Sala[];
  fornitori: Fornitore[];
  oli: ControlloOlio[];
  abbattimenti: Abbattimento[];
  setPostazione: (p: Postazione | null) => void;
  addSala: (nome: string, tipo: Sala["tipo"]) => void;
  deleteSala: (id: string) => void;
  addFornitore: (f: { nome: string; categoria: string; telefono: string; note: string }) => void;
  deleteFornitore: (id: string) => void;
  addOlio: (o: { vasca: string; polarita: string; filtro: string }) => void;
  deleteOlio: (id: string) => void;
  addAbbattimento: (a: { prodotto: string; tInizio: string; tFine: string; operatore: string }) => void;
  deleteAbbattimento: (id: string) => void;
  addTavolo: (salaId: string) => void;
  deleteTavolo: (id: number) => void;
};


export function localeStoreDefaults() {
  return {
    postazione: null as Postazione | null,
    sale: SALE_SEED.map((s) => ({ ...s })),
    fornitori: [
      { id: "fo1", nome: "Rossi Food", categoria: "Latticini", telefono: "3470000000", note: "Consegna lun/gio" },
      { id: "fo2", nome: "Pescheria Blu", categoria: "Pesce", telefono: "3331112233", note: "Mattina" },
    ],
    oli: [{ id: "ol1", vasca: "Friggitrice 1", polarita: 18, filtro: "Ok", ts: Date.now() - 86400000, ok: true }],
    abbattimenti: [] as Abbattimento[],
  };
}

export const useLocaleStore = create<Locale>()(
  persist(
    (set, get) => ({
      postazione: null,
      sale: SALE_SEED,
      fornitori: [
        { id: "fo1", nome: "Rossi Food", categoria: "Latticini", telefono: "3470000000", note: "Consegna lun/gio" },
        { id: "fo2", nome: "Pescheria Blu", categoria: "Pesce", telefono: "3331112233", note: "Mattina" },
      ],
      oli: [{ id: "ol1", vasca: "Friggitrice 1", polarita: 18, filtro: "Ok", ts: Date.now() - 86400000, ok: true }],
      abbattimenti: [],
      setPostazione: (p) => set({ postazione: p }),
      addSala: (nome, tipo) => set((s) => ({ sale: [...s.sale, { id: `sa-${Date.now()}`, nome: nome || (tipo === "esterna" ? "Sala esterna" : "Sala interna"), tipo }] })),
      deleteSala: (id) => {
        if (get().sale.length <= 1) return;
        set((s) => ({ sale: s.sale.filter((x) => x.id !== id) }));
      },
      addFornitore: (f) => set((s) => ({ fornitori: [{ id: `fo-${Date.now()}`, ...f, nome: f.nome || "Fornitore" }, ...s.fornitori] })),
      deleteFornitore: (id) => set((s) => ({ fornitori: s.fornitori.filter((x) => x.id !== id) })),
      addOlio: (o) => {
        const polarita = Number(o.polarita) || 0;
        set((s) => ({ oli: [{ id: `ol-${Date.now()}`, vasca: o.vasca || "Vasca", polarita, filtro: o.filtro || "-", ts: Date.now(), ok: polarita < 25 }, ...s.oli] }));
      },
      deleteOlio: (id) => set((s) => ({ oli: s.oli.filter((x) => x.id !== id) })),
      addAbbattimento: (a) => set((s) => ({
        abbattimenti: [{
          id: `ab-${Date.now()}`,
          prodotto: a.prodotto || "Prodotto",
          tInizio: Number(a.tInizio) || 70,
          tFine: Number(a.tFine) || 3,
          inizio: new Date().toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" }),
          fine: new Date().toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" }),
          operatore: a.operatore || "Cucina",
        }, ...s.abbattimenti],
      })),
      deleteAbbattimento: (id) => set((s) => ({ abbattimenti: s.abbattimenti.filter((x) => x.id !== id) })),
      addTavolo: (salaId) => {
        const tavoli = useMenteStore.getState().tavoli;
        const nextId = Math.max(0, ...tavoli.map((t) => t.id)) + 1;
        const count = tavoli.filter((t) => (t as { salaId?: string }).salaId === salaId).length;
        const col = count % 5;
        const row = Math.floor(count / 5);
        useMenteStore.setState({
          tavoli: [
            ...tavoli,
            {
              id: nextId,
              nome: `T${String(nextId).padStart(2, "0")}`,
              salaId,
              posti: 4,
              stato: "libero",
              x: 15 + col * 18,
              y: 18 + row * 22,
              clienti: 0,
              cameriere: "Sala",
              ordini: [],
              tempo: 0,
              animazione: "none",
            },
          ],
        });
      },
      deleteTavolo: (id) => {
        useMenteStore.setState({ tavoli: useMenteStore.getState().tavoli.filter((t) => t.id !== id) });
      },
    }),
    {
      name: "mente-locale-locale-v2",
      storage: createJSONStorage(() => scopedStorage),
    }
  )
);
