/** Tipi fiscali — software layer verso Registratore Telematico (non certificazione). */

export type AliquotaIva = 22 | 10 | 4 | 0;

export type FiscalRegime = "rf01" | "rf02" | "rf19" | string;

export type FiscalProfile = {
  partitaIva: string;
  codiceFiscale?: string;
  ragioneSociale: string;
  indirizzo: string;
  cap: string;
  citta: string;
  provincia: string;
  regime?: FiscalRegime;
  aliquotaDefault: AliquotaIva;
};

export type RtVendor = "epson_fpmate" | "custom_http" | "demo";

export type RtConfig = {
  enabled: boolean;
  vendor: RtVendor;
  host: string;
  port: number;
  path: string;
  devid: string;
  timeoutMs: number;
  useHttps: boolean;
};

export type PosProvider = "manual" | "sumup" | "nexi" | "stripe_terminal";

export type PosConfig = {
  enabled: boolean;
  provider: PosProvider;
  terminalId?: string;
  notes?: string;
};

/** Stampante non fiscale ESC/POS — solo preconto / comande. */
export type PrinterConfigFiscal = {
  escPosHost?: string;
  escPosPort?: number;
};

export type FiscalReceiptResult = {
  ok: boolean;
  protocollo?: string;
  dataOra?: string;
  error?: string;
  demo?: boolean;
};

export type FiscalRiga = {
  nome: string;
  qta: number;
  prezzo: number;
  aliquota?: AliquotaIva;
  note?: string;
};

export type FiscalPagamentoTipo = "contanti" | "carta" | "satispay" | "misto" | "altro";

export type FiscalPagamento = {
  tipo: FiscalPagamentoTipo;
  importo: number;
  descrizione?: string;
};

/** Bundle: ml:${localeId}:fiscal-v1 + tenants.settings.fiscal */
export type FiscalBundle = {
  profilo: FiscalProfile;
  rt: RtConfig;
  pos: PosConfig;
  printer: PrinterConfigFiscal;
  /**
   * Solo titolare. Se true, chiusura senza RT (ticket non fiscale).
   * Default false: con profilo completo chiusura fiscale obbligatoria.
   */
  demoNonFiscale: boolean;
};

export function defaultFiscalBundle(): FiscalBundle {
  return {
    profilo: {
      partitaIva: "",
      codiceFiscale: "",
      ragioneSociale: "",
      indirizzo: "",
      cap: "",
      citta: "",
      provincia: "",
      regime: "rf01",
      aliquotaDefault: 22,
    },
    rt: {
      enabled: false,
      vendor: "epson_fpmate",
      host: "",
      port: 80,
      path: "/cgi-bin/fpmate.cgi",
      devid: "local_printer",
      timeoutMs: 10000,
      useHttps: false,
    },
    pos: {
      enabled: false,
      provider: "manual",
      terminalId: "",
      notes: "",
    },
    printer: {
      escPosHost: "",
      escPosPort: 9100,
    },
    demoNonFiscale: false,
  };
}

export function isProfiloCompleto(p: FiscalProfile): boolean {
  const piva = (p.partitaIva || "").replace(/\D/g, "");
  return piva.length === 11 && (p.ragioneSociale || "").trim().length >= 2;
}

export function isFiscalRequired(b: FiscalBundle): boolean {
  return isProfiloCompleto(b.profilo) && b.rt.enabled && !b.demoNonFiscale && b.rt.vendor !== "demo";
}

export type FiscalStatusBadge = "mancante" | "configurato" | "rt_online" | "rt_offline";
