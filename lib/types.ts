export type Reparto = "cucina" | "bar";
export type StatoTavolo = "libero" | "occupato" | "prenotato" | "conto";
export type StatoOrdine = "ordinato" | "in_prep" | "pronto";

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

export type JobOffline = {
  id: string;
  tipo: "ordine" | "stato" | "chiudi";
  tavoloId: number;
  piatto?: Piatto;
  ordine?: Ordine;
  ordineId?: string;
  stato?: StatoOrdine;
  ts: number;
};

export type SyncEvent =
  | { kind: "nuovo_ordine"; tavoloId: number; ordine: Ordine; deviceId: string }
  | { kind: "stato_ordine"; ordineId: string; stato: StatoOrdine; deviceId: string }
  | { kind: "chiudi_tavolo"; tavoloId: number; deviceId: string };
