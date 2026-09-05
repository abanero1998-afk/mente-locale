"use client";

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

/** Fixed demo PINs seeded per locale (shown on create / login help for that locale). */
export const DEMO_STAFF_PINS: { nome: string; pin: string; ruolo: TenantStaff["ruolo"] }[] = [
  { nome: "Cameriere", pin: "0000", ruolo: "cameriere" },
  { nome: "Cucina", pin: "1111", ruolo: "cucina" },
  { nome: "Bar", pin: "2222", ruolo: "bar" },
];

function readRegistry(): Registry {
  if (typeof localStorage === "undefined") return { locali: [] };
  try {
    const raw = localStorage.getItem(REGISTRY_KEY);
    if (!raw) return { locali: [] };
    const parsed = JSON.parse(raw) as Registry;
    return { locali: Array.isArray(parsed?.locali) ? parsed.locali : [] };
  } catch {
    return { locali: [] };
  }
}

function writeRegistry(reg: Registry) {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(REGISTRY_KEY, JSON.stringify(reg));
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

export function listLocali(): LocaleTenant[] {
  return readRegistry().locali.slice().sort((a, b) => a.nome.localeCompare(b.nome, "it"));
}

export function getLocale(id: string): LocaleTenant | undefined {
  const lid = (id || "").trim().toLowerCase();
  return readRegistry().locali.find((l) => l.id === lid);
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
