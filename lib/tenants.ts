"use client";

import {
  TESTEMATTE_LOCALE_ID,
  TESTEMATTE_NOME,
  TESTEMATTE_PIN,
  TESTEMATTE_HARDWARE,
  isRtHardwareEmpty,
  testeMatteRtSeed,
} from "./locale-seeds/testematte";
import { defaultFiscalBundle } from "./fiscal/types";

export type LocaleSettings = {
  fondoIniziale?: number;
  waSocio?: string;
  nomeBrand?: string;
  /** Bundle fiscale per locale (multi-tenant). */
  fiscal?: import("./fiscal/types").FiscalBundle;
};

export type TenantStaff = {
  id: string;
  nome: string;
  pin: string;
  ruolo: "cameriere" | "cucina" | "bar" | "titolare";
};

export type LocaleTenant = {
  id: string;
  nome: string;
  createdAt: number;
  pinTitolare: string;
  settings: LocaleSettings;
  staff: TenantStaff[];
};

type Registry = { locali: LocaleTenant[] };

const REGISTRY_KEY = "ml-tenants-v1";

/** Session fallback if localStorage write fails (private mode / quota). */
let memoryLocali: LocaleTenant[] | null = null;

/** Fixed demo PINs seeded per locale (shown on create / login help for that locale). */
export const DEMO_STAFF_PINS: { nome: string; pin: string; ruolo: TenantStaff["ruolo"] }[] = [
  { nome: "Cameriere", pin: "0000", ruolo: "cameriere" },
  { nome: "Cucina", pin: "1111", ruolo: "cucina" },
  { nome: "Bar", pin: "2222", ruolo: "bar" },
];

function buildTesteMatte(): LocaleTenant {
  const id = TESTEMATTE_LOCALE_ID;
  const pinTitolare = TESTEMATTE_PIN;
  // Cameriere uses 3333 so PIN 0000 uniquely maps to titolare for this locale.
  const staff: TenantStaff[] = [
    { id: `s-tit-${id}`, nome: "Titolare", pin: pinTitolare, ruolo: "titolare" },
    { id: `s-cameriere-${id}`, nome: "Cameriere", pin: "3333", ruolo: "cameriere" },
    { id: `s-cucina-${id}`, nome: "Cucina", pin: "1111", ruolo: "cucina" },
    { id: `s-bar-${id}`, nome: "Bar", pin: "2222", ruolo: "bar" },
  ];
  return {
    id,
    nome: TESTEMATTE_NOME,
    createdAt: Date.now(),
    pinTitolare,
    settings: {
      fondoIniziale: 150,
      nomeBrand: TESTEMATTE_NOME,
      waSocio: "",
      // A8010V hardware seed — only this locale.
      fiscal: {
        ...defaultFiscalBundle(),
        rt: { ...testeMatteRtSeed(), hardwareModel: TESTEMATTE_HARDWARE.model },
      },
    },
    staff,
  };
}

function readRegistry(): Registry {
  if (typeof localStorage === "undefined") {
    return { locali: memoryLocali ? memoryLocali.slice() : [] };
  }
  try {
    const raw = localStorage.getItem(REGISTRY_KEY);
    if (!raw) {
      return { locali: memoryLocali ? memoryLocali.slice() : [] };
    }
    const parsed = JSON.parse(raw) as Registry;
    const locali = Array.isArray(parsed?.locali) ? parsed.locali : [];
    // Merge memory fallback entries missing from storage
    if (memoryLocali) {
      for (const m of memoryLocali) {
        if (!locali.some((l) => l.id === m.id)) locali.push(m);
      }
    }
    return { locali };
  } catch {
    return { locali: memoryLocali ? memoryLocali.slice() : [] };
  }
}

function writeRegistry(reg: Registry) {
  memoryLocali = reg.locali.slice();
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(REGISTRY_KEY, JSON.stringify(reg));
  } catch {
    // keep memoryLocali for this session
  }
}

export function slugifyLocaleId(nome: string): string {
  const base = (nome || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "")
    .slice(0, 32);
  return base || "locale";
}

function uniqueId(nome: string): string {
  const base = slugifyLocaleId(nome);
  const reg = readRegistry();
  if (!reg.locali.some((l) => l.id === base)) return base;
  let n = 2;
  while (reg.locali.some((l) => l.id === `${base}${n}`)) n += 1;
  return `${base}${n}`;
}

function sortedLocali(): LocaleTenant[] {
  return readRegistry().locali.slice().sort((a, b) => a.nome.localeCompare(b.nome, "it"));
}

/** Seed built-in demo locali (Teste Matte) so they appear in login without manual create. */
export function ensureSeededLocali(): LocaleTenant[] {
  const reg = readRegistry();
  if (!reg.locali.some((l) => l.id === TESTEMATTE_LOCALE_ID)) {
    reg.locali.push(buildTesteMatte());
    try {
      writeRegistry(reg);
    } catch {
      memoryLocali = reg.locali.slice();
    }
  } else {
    // Existing testematte: prefill A8010V only when RT host still empty.
    const idx = reg.locali.findIndex((l) => l.id === TESTEMATTE_LOCALE_ID);
    if (idx >= 0) {
      const cur = reg.locali[idx];
      const rt = cur.settings?.fiscal?.rt;
      if (isRtHardwareEmpty(rt)) {
        const base = defaultFiscalBundle();
        const fiscal = {
          ...base,
          ...(cur.settings?.fiscal || {}),
          profilo: { ...base.profilo, ...(cur.settings?.fiscal?.profilo || {}) },
          rt: { ...testeMatteRtSeed(), hardwareModel: TESTEMATTE_HARDWARE.model },
          pos: { ...base.pos, ...(cur.settings?.fiscal?.pos || {}) },
          printer: { ...base.printer, ...(cur.settings?.fiscal?.printer || {}) },
          demoNonFiscale: !!cur.settings?.fiscal?.demoNonFiscale,
        };
        reg.locali[idx] = {
          ...cur,
          settings: { ...cur.settings, fiscal },
        };
        try {
          writeRegistry(reg);
        } catch {
          memoryLocali = reg.locali.slice();
        }
      }
    }
    if (!memoryLocali) {
      memoryLocali = reg.locali.slice();
    }
  }
  // Always guarantee Teste Matte in the returned list for this session
  const list = sortedLocali();
  if (!list.some((l) => l.id === TESTEMATTE_LOCALE_ID)) {
    const tm = buildTesteMatte();
    if (!memoryLocali) memoryLocali = [];
    if (!memoryLocali.some((l) => l.id === tm.id)) memoryLocali.push(tm);
    return sortedLocali();
  }
  return list;
}

export function listLocali(): LocaleTenant[] {
  ensureSeededLocali();
  return sortedLocali();
}

function normLocaleKey(s: string): string {
  return (s || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "");
}

export function resolveLocale(input: string): LocaleTenant | undefined {
  ensureSeededLocali();
  const raw = (input || "").trim();
  if (!raw) return undefined;
  const key = normLocaleKey(raw);
  const all = readRegistry().locali;
  let hit = all.find(
    (l) => l.id === key || normLocaleKey(l.id) === key || normLocaleKey(l.nome) === key
  );
  if (hit) return hit;
  // aliases
  if (key === "testematte" || key === "testematteanzio" || key.startsWith("testematte")) {
    hit = all.find((l) => l.id === "testematte");
    if (hit) return hit;
    // force re-seed if missing
    ensureSeededLocali();
    return readRegistry().locali.find((l) => l.id === "testematte");
  }
  return undefined;
}

export function getLocale(id: string): LocaleTenant | undefined {
  return resolveLocale(id);
}

export function getStaffForLocale(localeId: string): TenantStaff[] {
  return getLocale(localeId)?.staff || [];
}

export function createLocale(input: { nome: string; pinTitolare: string }): {
  ok: boolean;
  error?: string;
  locale?: LocaleTenant;
  demoPins?: { nome: string; pin: string; ruolo: string }[];
} {
  const nome = (input.nome || "").trim();
  const pinTitolare = (input.pinTitolare || "").trim();
  if (nome.length < 2) return { ok: false, error: "Nome locale troppo corto" };
  if (!/^\d{4,8}$/.test(pinTitolare)) return { ok: false, error: "PIN titolare: 4–8 cifre" };

  const id = uniqueId(nome);
  const staff: TenantStaff[] = [
    { id: `s-tit-${id}`, nome: "Titolare", pin: pinTitolare, ruolo: "titolare" },
    ...DEMO_STAFF_PINS.map((d, i) => ({
      id: `s-${d.ruolo}-${id}-${i}`,
      nome: d.nome,
      pin: d.pin,
      ruolo: d.ruolo,
    })),
  ];

  const locale: LocaleTenant = {
    id,
    nome,
    createdAt: Date.now(),
    pinTitolare,
    settings: {
      fondoIniziale: 150,
      nomeBrand: nome,
      waSocio: "",
    },
    staff,
  };

  const reg = readRegistry();
  reg.locali.push(locale);
  writeRegistry(reg);

  const demoPins = [
    { nome: "Titolare", pin: pinTitolare, ruolo: "titolare" },
    ...DEMO_STAFF_PINS.map((d) => ({ nome: d.nome, pin: d.pin, ruolo: d.ruolo })),
  ];
  return { ok: true, locale, demoPins };
}

export function updateLocaleSettings(
  localeId: string,
  patch: Partial<LocaleSettings> & { nome?: string }
): LocaleTenant | null {
  const reg = readRegistry();
  const idx = reg.locali.findIndex((l) => l.id === localeId);
  if (idx < 0) return null;
  const cur = reg.locali[idx];
  const next: LocaleTenant = {
    ...cur,
    nome: patch.nome !== undefined ? patch.nome.trim() || cur.nome : cur.nome,
    settings: {
      ...cur.settings,
      ...(patch.fondoIniziale !== undefined ? { fondoIniziale: Number(patch.fondoIniziale) || 0 } : {}),
      ...(patch.waSocio !== undefined ? { waSocio: String(patch.waSocio).trim() } : {}),
      ...(patch.nomeBrand !== undefined ? { nomeBrand: String(patch.nomeBrand).trim() } : {}),
      ...(patch.fiscal !== undefined ? { fiscal: patch.fiscal } : {}),
    },
  };
  if (patch.nome !== undefined && patch.nome.trim()) {
    // keep pinTitolare staff nome display brand separately
  }
  reg.locali[idx] = next;
  writeRegistry(reg);
  return next;
}

export function findStaffByPin(localeId: string, pin: string): TenantStaff | undefined {
  const p = (pin || "").trim();
  return getStaffForLocale(localeId).find((s) => s.pin === p);
}
