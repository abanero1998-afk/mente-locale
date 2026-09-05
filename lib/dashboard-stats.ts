import type { ScontrinoCassa } from "./cassa";

export type TopProdotto = { nome: string; qta: number };
export type OraPunta = { ora: number; label: string; count: number; totale: number };
export type KpiOggi = { totale: number; nScontrini: number; coperti: number };

function dayKeyLocal(ts: number) {
  const d = new Date(ts);
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

/** Aggrega qty per nome da scontrini cassa reali (righe). */
export function topProdotti(scontrini: ScontrinoCassa[], limit = 8): TopProdotto[] {
  const agg: Record<string, number> = {};
  for (const sc of scontrini) {
    for (const r of sc.righe || []) {
      const nome = (r.nome || "").trim();
      if (!nome) continue;
      agg[nome] = (agg[nome] || 0) + (Number(r.qta) || 0);
    }
  }
  const keys = Object.keys(agg);
  const rows: TopProdotto[] = [];
  for (let i = 0; i < keys.length; i++) {
    const nome = keys[i];
    rows.push({ nome, qta: agg[nome] });
  }
  rows.sort((a, b) => b.qta - a.qta);
  const n = Math.min(Math.max(limit, 5), 8);
  return rows.slice(0, n);
}

/** Bucket per ora locale del browser (Rome se TZ dispositivo). */
export function orariPunta(scontrini: ScontrinoCassa[]): OraPunta[] {
  const buckets: Record<number, { count: number; totale: number }> = {};
  for (const sc of scontrini) {
    const h = new Date(sc.ts).getHours();
    if (!buckets[h]) buckets[h] = { count: 0, totale: 0 };
    buckets[h].count += 1;
    buckets[h].totale += Number(sc.totale) || 0;
  }
  const keys = Object.keys(buckets);
  const rows: OraPunta[] = [];
  for (let i = 0; i < keys.length; i++) {
    const ora = Number(keys[i]);
    const b = buckets[ora];
    rows.push({
      ora,
      label: `${String(ora).padStart(2, "0")}:00`,
      count: b.count,
      totale: b.totale,
    });
  }
  rows.sort((a, b) => b.count - a.count || b.totale - a.totale);
  return rows;
}

export function kpiOggi(scontrini: ScontrinoCassa[]): KpiOggi {
  const today = dayKeyLocal(Date.now());
  let totale = 0;
  let nScontrini = 0;
  let coperti = 0;
  for (const x of scontrini) {
    if (dayKeyLocal(x.ts) !== today) continue;
    nScontrini += 1;
    totale += Number(x.totale) || 0;
    coperti += Number(x.coperti) || 0;
  }
  return { totale, nScontrini, coperti };
}
