"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Postazione } from "./types";

export type StaffRole = Postazione | "titolare";

export type Staff = {
  id: string;
  nome: string;
  pin: string;
  ruolo: StaffRole;
};

export type Sessione = {
  localeId: string;
  localeNome: string;
  staffId: string;
  staffNome: string;
  ruolo: StaffRole;
};

/** Demo seed: un locale, nessuno vede altri clienti. */
const STAFF_SEED: Staff[] = [
  { id: "s1", nome: "Luca", pin: "0000", ruolo: "cameriere" },
  { id: "s2", nome: "Sara", pin: "1111", ruolo: "cucina" },
  { id: "s3", nome: "Marco", pin: "2222", ruolo: "bar" },
  { id: "s4", nome: "Sergio", pin: "9999", ruolo: "titolare" },
];

type AuthState = {
  localeId: string;
  localeNome: string;
  staff: Staff[];
  sessione: Sessione | null;
  errore: string;
  login: (localeId: string, pin: string) => boolean;
  logout: () => void;
};

export const useAuth = create<AuthState>()(
  persist(
    (set, get) => ({
      localeId: "mentelocale",
      localeNome: "Mente Locale",
      staff: STAFF_SEED,
      sessione: null,
      errore: "",
      login: (localeId, pin) => {
        const id = localeId.trim().toLowerCase().replace(/\s+/g, "") || "mentelocale";
        const user = get().staff.find((s) => s.pin === pin.trim());
        if (!user) {
          set({ errore: "PIN non valido", sessione: null });
          return false;
        }
        set({
          localeId: id,
          localeNome: id === "mentelocale" ? "Mente Locale" : id,
          errore: "",
          sessione: {
            localeId: id,
            localeNome: id === "mentelocale" ? "Mente Locale" : id,
            staffId: user.id,
            staffNome: user.nome,
            ruolo: user.ruolo,
          },
        });
        return true;
      },
      logout: () => set({ sessione: null, errore: "" }),
    }),
    { name: "ml-auth-v1" }
  )
);

export function canFullApp(ruolo: StaffRole) {
  return ruolo === "cameriere" || ruolo === "titolare";
}
