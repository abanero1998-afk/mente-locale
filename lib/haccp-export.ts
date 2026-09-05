import type { ArticoloMagazzino, Frigo, LogTemp, Lotto, Pulizia } from "./types";

export function buildAslCsv(input: {
  lotti: Lotto[];
  magazzino: ArticoloMagazzino[];
  frighi: Frigo[];
  logTemp: LogTemp[];
  pulizie: Pulizia[];
}) {
  const fmt = (ts: number) => new Date(ts).toLocaleString("it-IT");
  const lines = [
    "MENTE LOCALE — REGISTRO HACCP / ASL",
    `Generato,${new Date().toLocaleString("it-IT")}`,
    "",
    "=== LOTTI ===",
    "Prodotto,Lotto,Apertura,Scadenza,Giorni,Operatore",
    ...input.lotti.map((l) => [l.prodotto, l.lotto, l.apertura, l.scadenza, l.giorni_rimasti, l.operatore].join(",")),
    "",
    "=== MAGAZZINO ===",
    "Articolo,Quantita,Unita,Soglia,Stato",
    ...input.magazzino.map((m) => [m.nome, m.qta, m.unita, m.soglia, m.qta < m.soglia ? "SOTTO SCORTA" : "OK"].join(",")),
    "",
    "=== FRIGHI ===",
    "Frigo,Temp,Min,Max,Ultimo check,Stato",
    ...input.frighi.map((f) => [f.nome, f.temp, f.min, f.max, f.lastCheck ? fmt(f.lastCheck) : "-", f.temp < f.min || f.temp > f.max ? "FUORI RANGE" : "OK"].join(",")),
    "",
    "=== LOG TEMPERATURE ===",
    "Frigo,Temp,Quando,Operatore",
    ...input.logTemp.slice(0, 200).map((t) => [t.nome, t.temp, fmt(t.ts), t.operatore].join(",")),
    "",
    "=== PULIZIA LOCALE ===",
    "Zona,Operatore,Stato,Quando,Note",
    ...input.pulizie.map((p) => [p.zona, p.operatore, p.fatto ? "FATTO" : "DA FARE", fmt(p.ts), p.note.replace(/,/g, " ")].join(",")),
  ];
  return lines.join("\n");
}

export function downloadAslFile(csv: string) {
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `ASL-Mente-Locale-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}


export function buildTempOnlyCsv(logTemp: LogTemp[]) {
  const fmt = (ts: number) => new Date(ts).toLocaleString("it-IT");
  const lines = [
    "MENTE LOCALE — LOG TEMPERATURE FRIGHI",
    `Generato,${new Date().toLocaleString("it-IT")}`,
    "",
    "Frigo,Temp,Quando,Operatore,Id",
    ...logTemp.map((t) => [t.nome, t.temp, fmt(t.ts), t.operatore, t.id].join(",")),
  ];
  return lines.join("\n");
}

export function downloadTempLog(csv: string) {
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `temperature-log-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
