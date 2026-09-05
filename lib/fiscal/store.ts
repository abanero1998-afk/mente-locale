"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { scopedStorage, getCurrentLocaleId } from "../scoped-storage";
import { getLocale, updateLocaleSettings } from "../tenants";
import {
  defaultFiscalBundle,
  isProfiloCompleto,
  type FiscalBundle,
  type FiscalStatusBadge,
  type RtConfig,
} from "./types";
import { testConnection } from "./epson-fpmate";
import { test3iXonxoffConnection } from "./xonxoff-3i";

type FiscalState = FiscalBundle & {
  rtLastOnline: boolean | null;
  rtLastCheckTs: number;
  hydrated: boolean;
  setProfilo: (patch: Partial<FiscalBundle["profilo"]>) => void;
  setRt: (patch: Partial<RtConfig>) => void;
  setPos: (patch: Partial<FiscalBundle["pos"]>) => void;
  setPrinter: (patch: Partial<FiscalBundle["printer"]>) => void;
  setDemoNonFiscale: (v: boolean) => void;
  replaceBundle: (b: FiscalBundle) => void;
  syncToTenant: () => void;
  loadFromTenant: () => void;
  testRt: () => Promise<{ ok: boolean; error?: string }>;
  statusBadge: () => FiscalStatusBadge;
};

function bundleOf(s: FiscalState): FiscalBundle {
  return {
    profilo: s.profilo,
    rt: s.rt,
    pos: s.pos,
    printer: s.printer,
    demoNonFiscale: s.demoNonFiscale,
  };
}

export const useFiscal = create<FiscalState>()(
  persist(
    (set, get) => ({
      ...defaultFiscalBundle(),
      rtLastOnline: null,
      rtLastCheckTs: 0,
      hydrated: false,
      setProfilo: (patch) => set((s) => ({ profilo: { ...s.profilo, ...patch } })),
      setRt: (patch) => set((s) => ({ rt: { ...s.rt, ...patch } })),
      setPos: (patch) => set((s) => ({ pos: { ...s.pos, ...patch } })),
      setPrinter: (patch) => set((s) => ({ printer: { ...s.printer, ...patch } })),
      setDemoNonFiscale: (v) => set({ demoNonFiscale: !!v }),
      replaceBundle: (b) =>
        set({
          profilo: b.profilo,
          rt: b.rt,
          pos: b.pos,
          printer: b.printer,
          demoNonFiscale: !!b.demoNonFiscale,
        }),
      syncToTenant: () => {
        const id = getCurrentLocaleId();
        if (!id) return;
        const b = bundleOf(get());
        updateLocaleSettings(id, { fiscal: b });
      },
      loadFromTenant: () => {
        const id = getCurrentLocaleId();
        if (!id) return;
        const loc = getLocale(id);
        const f = loc?.settings?.fiscal;
        if (f && f.profilo) {
          const base = defaultFiscalBundle();
          set({
            profilo: { ...base.profilo, ...f.profilo },
            rt: { ...base.rt, ...f.rt },
            pos: { ...base.pos, ...f.pos },
            printer: { ...base.printer, ...f.printer },
            demoNonFiscale: !!f.demoNonFiscale,
          });
        }
      },
      testRt: async () => {
        const rt = get().rt;
        const res =
          rt.vendor === "3i_xonxoff"
            ? await test3iXonxoffConnection(rt)
            : await testConnection(rt);
        set({ rtLastOnline: res.ok, rtLastCheckTs: Date.now() });
        return { ok: res.ok, error: res.error };
      },
      statusBadge: () => {
        const s = get();
        if (!isProfiloCompleto(s.profilo) || !s.rt.enabled) return "mancante";
        if (s.rt.vendor === "demo" || s.demoNonFiscale) return "configurato";
        if (s.rtLastOnline === true) return "rt_online";
        if (s.rtLastOnline === false) return "rt_offline";
        return "configurato";
      },
    }),
    {
      name: "fiscal-v1",
      storage: createJSONStorage(() => scopedStorage),
      partialize: (s) => ({
        profilo: s.profilo,
        rt: s.rt,
        pos: s.pos,
        printer: s.printer,
        demoNonFiscale: s.demoNonFiscale,
        rtLastOnline: s.rtLastOnline,
        rtLastCheckTs: s.rtLastCheckTs,
      }),
      onRehydrateStorage: () => (state) => {
        if (state) state.hydrated = true;
      },
    }
  )
);

export function getFiscalBundle(): FiscalBundle {
  const s = useFiscal.getState();
  return bundleOf(s);
}
