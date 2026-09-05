"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

export type Pagamento = "contanti" | "carta" | "satispay" | "misto";

export type SplitParte = {
  label: string;
  importo: number;
  pagamento: Pagamento;
};

export type RigaScontrino = {
  nome: string;
  qta: number;
  prezzo: number;
  note?: string;
};

export type ScontrinoCassa = {
  id: string;
  tavolo: string;
  tavoloId: number;
  righe: RigaScontrino[];
  coperti: number;
  subtotale: number;
  /** Importo sconto in € (già calcolato) */
  sconto: number;
  /** Percentuale sconto se applicata (informativa) */
  scontoPct?: number;
  mancia: number;
  totale: number;
  pagamento: Pagamento;
  /** Se pagamento misto: importi parziali */
  mistoDettaglio?: { contanti: number; carta: number };
  splitParti?: number;
  splitDettaglio?: SplitParte[];
  operatore: string;
  ts: number;
  stato?: "emesso" | "annullato";
  riferimentoPos?: string;
  noteFiscali?: string;
  motivoAnnullamento?: string;
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
  mance: number;
  fondo: number;
  cassaAttesa: number;
  contato: number;
  differenza: number;
  operatore: string;
  ts: number;
};

function dayKey(ts: number) {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function isAttivo(s: ScontrinoCassa) {
  return (s.stato || "emesso") !== "annullato";
}

type CassaState = {
  scontrini: ScontrinoCassa[];
  chiusure: Chiusura[];
  fondo: number;
  emetti: (s: Omit<ScontrinoCassa, "id" | "ts" | "stato"> & { stato?: "emesso" | "annullato" }) => ScontrinoCassa;
  annulla: (id: string, motivo: string) => void;
  chiudiSerata: (fondoContato: number, operatore: string) => Chiusura;
  setFondo: (n: number) => void;
  scontriniOggiAttivi: () => ScontrinoCassa[];
};

export const useCassa = create<CassaState>()(
  persist(
    (set, get) => ({
      scontrini: [],
      chiusure: [],
      fondo: 150,
      setFondo: (n) => set({ fondo: Math.max(0, Number(n) || 0) }),
      scontriniOggiAttivi: () => {
        const oggi = dayKey(Date.now());
        return get().scontrini.filter((x) => dayKey(x.ts) === oggi && isAttivo(x));
      },
      emetti: (s) => {
        const row: ScontrinoCassa = {
          ...s,
          mancia: Number(s.mancia) || 0,
          sconto: Number(s.sconto) || 0,
          stato: s.stato || "emesso",
          id: `sc-${Date.now()}`,
          ts: Date.now(),
        };
        set((st) => ({ scontrini: [row, ...st.scontrini] }));
        return row;
      },
      annulla: (id, motivo) => {
        set((st) => ({
          scontrini: st.scontrini.map((x) =>
            x.id === id
              ? { ...x, stato: "annullato", motivoAnnullamento: (motivo || "").trim() || "Annullato" }
              : x
          ),
        }));
      },
      chiudiSerata: (fondoContato, operatore) => {
        const oggi = dayKey(Date.now());
        const list = get().scontrini.filter((x) => dayKey(x.ts) === oggi && isAttivo(x));
        const sumPag = (p: Pagamento) =>
          list.filter((x) => x.pagamento === p).reduce((a, x) => a + x.totale, 0);
        const totale = list.reduce((a, x) => a + x.totale, 0);
        const coperti = list.reduce((a, x) => a + x.coperti, 0);
        const mance = list.reduce((a, x) => a + (Number(x.mancia) || 0), 0);
        const contanti = sumPag("contanti");
        const misto = sumPag("misto");
        // Contanti attesi: fondo + contanti puri + parte contanti di misto (se dettagliata, altrimenti 50%)
        let mistoContanti = 0;
        for (const x of list) {
          if (x.pagamento !== "misto") continue;
          if (x.mistoDettaglio) mistoContanti += Number(x.mistoDettaglio.contanti) || 0;
          else mistoContanti += x.totale * 0.5;
        }
        const cassaAttesa = get().fondo + contanti + mistoContanti;
        const contatto = Number(fondoContato) || 0;
        const chiusura: Chiusura = {
          id: `ch-${Date.now()}`,
          data: oggi,
          coperti,
          scontrini: list.length,
          contanti,
          carta: sumPag("carta"),
          satispay: sumPag("satispay"),
          misto,
          totale,
          mance,
          fondo: get().fondo,
          cassaAttesa,
          contato: contatto,
          differenza: contatto - cassaAttesa,
          operatore,
          ts: Date.now(),
        };
        set((st) => ({ chiusure: [chiusura, ...st.chiusure], fondo: contatto }));
        return chiusura;
      },
    }),
    { name: "ml-cassa-v2" }
  )
);

export function scontriniAttivi(list: ScontrinoCassa[]) {
  return list.filter(isAttivo);
}

export { dayKey as cassaDayKey, isAttivo as scontrinoAttivo };
