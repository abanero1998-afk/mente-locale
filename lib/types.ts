export type Reparto = "cucina" | "bar";
export type StatoTavolo = "libero" | "occupato" | "prenotato" | "conto";
export type StatoOrdine = "ordinato" | "in_prep" | "pronto";
export type StatoPrenotazione = "da_confermare" | "confermata" | "vip" | "cancellata";

export type Piatto = {
  id: string;
  nome: string;
  prezzo: number;
  reparto: Reparto;
  categoria: string;
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
};

export type Tavolo = {
  id: number;
  nome: string;
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
  | { kind: "avviso_socio"; msg: string; urgente: boolean; deviceId: string };
