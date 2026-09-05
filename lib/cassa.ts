"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

export type Pagamento = "contanti" | "carta" | "satispay" | "misto";

export type ScontrinoCassa = {
  id: string;
  tavolo: string;
  tavoloId: number;
  righe: { nome: string; qta: number; prezzo: number }[];
  coperti: number;
  subtotale: number;
  sconto: number;
  totale: number;
  pagamento: Pagamento;
  operatore: string;
  ts: number;
};

export type Chiusura = {
  id: string;
  data: string;
  coperti: number;
  scontrini: number;
  contanti: number;
  carta: number;
  satispay: number;
  misto: number;
  totale: number;
  fondo: number;
  cassaAttesa: number;
  differenza: number;
  operatore: string;
  ts: number;
};

type CassaState = {
  scontrini: ScontrinoCassa[];
  chiusure: Chiusura[];
  fondo: number;
  emetti: (s: Omit<ScontrinoCassa, "id" | "ts">) => ScontrinoCassa;
  chiudiSerata: (fondoContato: number, operatore: string) => Chiusura;
  setFondo: (n: number) => void;
};

export const useCassa = create<CassaState>()(
  persist(
    (set, get) => ({
      scontrini: [],
      chiusure: [],
      fondo: 150,
      setFondo: (n) => set({ fondo: n }),
      emetti: (s) => {
        const row: ScontrinoCassa = { ...s, id: `sc-${Date.now()}`, ts: Date.now() };
        set((st) => ({ scontrini: [row, ...st.scontrini] }));
        return row;
      },
      chiudiSerata: (fondoContato, operatore) => {
        const oggi = new Date().toISOString().slice(0, 10);
        const list = get().scontrini.filter((x) => new Date(x.ts).toISOString().slice(0, 10) === oggi);
        const sum = (p: Pagamento) => list.filter((x) => x.pagamento === p).reduce((a, x) => a + x.totale, 0);
        const totale = list.reduce((a, x) => a + x.totale, 0);
        const coperti = list.reduce((a, x) => a + x.coperti, 0);
        const cassaAttesa = get().fondo + sum("contanti") + sum("misto") * 0.5;
        const chiusura: Chiusura = {
          id: `ch-${Date.now()}`,
          data: oggi,
          coperti,
          scontrini: list.length,
          contanti: sum("contanti"),
          carta: sum("carta"),
          satispay: sum("satispay"),
          misto: sum("misto"),
          totale,
          fondo: get().fondo,
          cassaAttesa,
          differenza: fondoContato - cassaAttesa,
          operatore,
          ts: Date.now(),
        };
        set((st) => ({ chiusure: [chiusura, ...st.chiusure], fondo: fondoContato }));
        return chiusura;
      },
    }),
    { name: "ml-cassa-v1" }
  )
);
