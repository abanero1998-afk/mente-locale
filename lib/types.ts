export type Reparto = "cucina" | "bar";
export type StatoTavolo = "libero" | "occupato" | "prenotato" | "conto";
export type StatoOrdine = "ordinato" | "in_prep" | "pronto";
export type StatoPrenotazione = "da_confermare" | "confermata" | "vip" | "cancellata";
export type PrinterMode = "zpl" | "bt" | "https";
export type Postazione = "cameriere" | "cucina" | "bar";
export type TipoSala = "interna" | "esterna";
export type HaccpView =
  | "hub"
  | "fornitori"
  | "pulizia"
  | "scadenze"
  | "frighi"
  | "olio"
  | "tracciabilita"
  | "etichetta"
  | "abbattimento"
  | "stampante"
  | "asl";

/** Sezioni menu operative (ordine UI). */
export const SEZIONI_MENU = [
  "Primi",
  "Secondi",
  "Contorni",
  "Dolci",
  "Bevande",
  "Vini",
] as const;

export type SezioneMenu = (typeof SEZIONI_MENU)[number];

export type Piatto = {
  id: string;
  nome: string;
  prezzo: number;
  reparto: Reparto;
  categoria: string;
  /** URL immagine prodotto (non emoji). */
  img: string;
};

export type Ordine = {
  id: string;
  piatto: Piatto;
  qta: number;
  note?: string;
  stato: StatoOrdine;
  ora: string;
};

export type RigaComanda = {
  id: string;
  piatto: Piatto;
  qta: number;
  nota?: string;
};

export type Sala = {
  id: string;
  nome: string;
  tipo: TipoSala;
};

export type Tavolo = {
  id: number;
  nome: string;
  salaId: string;
  posti: number;
  stato: StatoTavolo;
  x: number;
  y: number;
  clienti: number;
  cameriere: string;
  ordini: Ordine[];
  tempo: number;
  animazione?: "pulse" | "none";
};

export type ArticoloMagazzino = {
  id: string;
  nome: string;
  qta: number;
  unita: string;
  soglia: number;
};

export type Frigo = {
  id: string;
  nome: string;
  temp: number;
  min: number;
  max: number;
  lastCheck: number;
};

export type LogTemp = {
  id: string;
  frigoId: string;
  nome: string;
  temp: number;
  ts: number;
  operatore: string;
};

export type Lotto = {
  id: string;
  prodotto: string;
  lotto: string;
  apertura: string;
  scadenza: string;
  giorni_rimasti: number;
  operatore: string;
  note?: string;
  produzione?: string;
};

export type Pulizia = {
  id: string;
  zona: string;
  operatore: string;
  fatto: boolean;
  ts: number;
  note: string;
};

export type Fornitore = {
  id: string;
  nome: string;
  categoria: string;
  telefono: string;
  note: string;
};

export type ControlloOlio = {
  id: string;
  vasca: string;
  polarita: number;
  filtro: string;
  ts: number;
  ok: boolean;
};

export type Abbattimento = {
  id: string;
  prodotto: string;
  tInizio: number;
  tFine: number;
  inizio: string;
  fine: string;
  operatore: string;
};

export type PrinterConfig = {
  mode: PrinterMode;
  ip: string;
  port: string;
  btName: string;
  httpsUrl: string;
};

export type Prenotazione = {
  id: string;
  initials: string;
  nome: string;
  persone: number;
  tavolo: string;
  quando: string;
  stato: StatoPrenotazione;
  fonte: "whatsapp" | "telefono" | "walkin";
};

export type Scontrino = {
  id: string;
  tavoloId: number;
  totale: number;
  minuti: number;
  ts: number;
};

export type AvvisoSocio = {
  id: string;
  msg: string;
  urgente: boolean;
  ts: number;
};

export type JobOffline = {
  id: string;
  tipo: "ordine" | "stato" | "chiudi" | "prodotto_add" | "prodotto_del";
  tavoloId: number;
  piatto?: Piatto;
  ordine?: Ordine;
  ordineId?: string;
  stato?: StatoOrdine;
  prodottoId?: string;
  ts: number;
};

export type SyncEvent =
  | { kind: "nuovo_ordine"; tavoloId: number; ordine: Ordine; deviceId: string }
  | { kind: "stato_ordine"; ordineId: string; stato: StatoOrdine; deviceId: string }
  | { kind: "chiudi_tavolo"; tavoloId: number; deviceId: string }
  | { kind: "prodotto_add"; piatto: Piatto; deviceId: string }
  | { kind: "prodotto_del"; prodottoId: string; deviceId: string }
  | { kind: "avviso_socio"; msg: string; urgente: boolean; deviceId: string }
  | { kind: "presence"; deviceId: string; nome: string; ruolo: string; ts: number }
  | { kind: "sync_ping"; deviceId: string; ts: number };
