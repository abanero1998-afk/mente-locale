"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Postazione } from "./types";
import {
  createLocale as createLocaleTenant,
  ensureSeededLocali,
  findStaffByPin,
  getLocale,
  listLocali,
  type LocaleTenant,
} from "./tenants";

export type StaffRole = Postazione | "titolare";

export type Sessione = {
  localeId: string;
  localeNome: string;
  staffId: string;
  staffNome: string;
  ruolo: StaffRole;
};

export type DemoPinRow = { nome: string; pin: string; ruolo: string };

type AuthState = {
  sessione: Sessione | null;
  errore: string;
  /** Shown once after "Crea locale" — demo PINs for that locale only. */
  lastCreatedPins: DemoPinRow[] | null;
  lastCreatedLocaleId: string | null;
  login: (localeId: string, pin: string) => boolean;
  createLocale: (nome: string, pinTitolare: string) => boolean;
  logout: () => void;
  /** Clear session to pick another locale without deleting tenant data. */
  cambiaLocale: () => void;
  clearCreatedPins: () => void;
};

function activate(localeId: string) {
  void import("./tenant-runtime").then((m) => m.activateLocale(localeId));
}

export const useAuth = create<AuthState>()(
  persist(
    (set) => ({
      sessione: null,
      errore: "",
      lastCreatedPins: null,
      lastCreatedLocaleId: null,
      createLocale: (nome, pinTitolare) => {
        const res = createLocaleTenant({ nome, pinTitolare });
        if (!res.ok || !res.locale) {
          set({ errore: res.error || "Creazione fallita", sessione: null });
          return false;
        }
        const loc = res.locale;
        set({
          errore: "",
          lastCreatedPins: res.demoPins || null,
          lastCreatedLocaleId: loc.id,
          sessione: {
            localeId: loc.id,
            localeNome: loc.settings.nomeBrand || loc.nome,
            staffId: loc.staff.find((s) => s.ruolo === "titolare")?.id || loc.staff[0].id,
            staffNome: "Titolare",
            ruolo: "titolare",
          },
        });
        activate(loc.id);
        return true;
      },
      login: (localeId, pin) => {
        const id = (localeId || "").trim().toLowerCase().replace(/\s+/g, "");
        if (!id) {
          set({ errore: "Seleziona o inserisci un locale", sessione: null });
          return false;
        }
        const loc = getLocale(id);
        if (!loc) {
          set({ errore: "Locale non trovato — crealo prima", sessione: null });
          return false;
        }
        const user = findStaffByPin(id, pin);
        if (!user) {
          set({ errore: "PIN non valido per questo locale", sessione: null });
          return false;
        }
        const brand = loc.settings.nomeBrand || loc.nome;
        set({
          errore: "",
          lastCreatedPins: null,
          sessione: {
            localeId: loc.id,
            localeNome: brand,
            staffId: user.id,
            staffNome: user.nome,
            ruolo: user.ruolo,
          },
        });
        activate(loc.id);
        return true;
      },
      logout: () => {
        set({ sessione: null, errore: "", lastCreatedPins: null });
        void import("./tenant-runtime").then((m) => m.deactivateLocale());
      },
      cambiaLocale: () => {
        set({ sessione: null, errore: "", lastCreatedPins: null });
        void import("./tenant-runtime").then((m) => m.deactivateLocale());
      },
      clearCreatedPins: () => set({ lastCreatedPins: null }),
    }),
    {
      name: "ml-auth-v2",
      partialize: (s) => ({
        sessione: s.sessione,
        lastCreatedLocaleId: s.lastCreatedLocaleId,
      }),
      onRehydrateStorage: () => (state) => {
        ensureSeededLocali();
        const id = state?.sessione?.localeId;
        if (id) activate(id);
      },
    }
  )
);

export function canFullApp(ruolo: StaffRole) {
  return ruolo === "cameriere" || ruolo === "titolare";
}

export { listLocali, getLocale };
export type { LocaleTenant };
