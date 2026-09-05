import type { Chiusura, ScontrinoCassa } from "./cassa";
import { scontrinoAttivo } from "./cassa";
import { apriStampa } from "./ticket";
import { orariPunta, topProdotti } from "./dashboard-stats";
import type { LogTemp } from "./types";

function escCsv(v: string | number) {
  const s = String(v ?? "");
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function downloadCsv(filename: string, csv: string) {
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export type Periodo = "oggi" | "7gg" | "30gg" | "custom";

export function rangeFromPeriodo(periodo: Periodo, from?: string, to?: string): { start: number; end: number } {
  const now = new Date();
  const end = now.getTime() + 86400000; // include oggi
  if (periodo === "custom" && from && to) {
    const s = new Date(from + "T00:00:00").getTime();
    const e = new Date(to + "T23:59:59").getTime();
    return { start: s, end: e };
  }
  const startDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (periodo === "oggi") return { start: startDay.getTime(), end };
  if (periodo === "7gg") return { start: startDay.getTime() - 6 * 86400000, end };
  return { start: startDay.getTime() - 29 * 86400000, end };
}

export function filterScontriniPeriodo(
  scontrini: ScontrinoCassa[],
  periodo: Periodo,
  from?: string,
  to?: string
): ScontrinoCassa[] {
  const { start, end } = rangeFromPeriodo(periodo, from, to);
  return scontrini.filter((s) => scontrinoAttivo(s) && s.ts >= start && s.ts <= end);
}

/** Vendite periodo CSV — una riga per prodotto. */
export function buildVenditeCsv(scontrini: ScontrinoCassa[]): string {
  const header =
    "data,ora,tavolo,prodotto,qta,prezzo,riga_totale,pagamento,mancia,operatore,scontrino_id";
  const lines: string[] = [header];
  for (const sc of scontrini) {
    const d = new Date(sc.ts);
    const data = d.toLocaleDateString("it-IT");
    const ora = d.toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" });
    const mancia = Number(sc.mancia) || 0;
    for (const r of sc.righe || []) {
      const rigaTot = (Number(r.qta) || 0) * (Number(r.prezzo) || 0);
      lines.push(
        [
          escCsv(data),
          escCsv(ora),
          escCsv(sc.tavolo),
          escCsv(r.nome),
          escCsv(r.qta),
          escCsv((Number(r.prezzo) || 0).toFixed(2)),
          escCsv(rigaTot.toFixed(2)),
          escCsv(sc.pagamento),
          escCsv(mancia.toFixed(2)),
          escCsv(sc.operatore),
          escCsv(sc.id),
        ].join(",")
      );
    }
  }
  return lines.join("\n");
}

export function buildChiusureCsv(chiusure: Chiusura[]): string {
  const header =
    "data,coperti,scontrini,contanti,carta,satispay,misto,totale,mance,fondo,cassa_attesa,contato,differenza,operatore,ts";
  const lines = [header];
  for (const c of chiusure) {
    lines.push(
      [
        escCsv(c.data),
        escCsv(c.coperti),
        escCsv(c.scontrini),
        escCsv((c.contanti || 0).toFixed(2)),
        escCsv((c.carta || 0).toFixed(2)),
        escCsv((c.satispay || 0).toFixed(2)),
        escCsv((c.misto || 0).toFixed(2)),
        escCsv((c.totale || 0).toFixed(2)),
        escCsv((c.mance || 0).toFixed(2)),
        escCsv((c.fondo || 0).toFixed(2)),
        escCsv((c.cassaAttesa || 0).toFixed(2)),
        escCsv((c.contato || 0).toFixed(2)),
        escCsv((c.differenza || 0).toFixed(2)),
        escCsv(c.operatore),
        escCsv(new Date(c.ts).toLocaleString("it-IT")),
      ].join(",")
    );
  }
  return lines.join("\n");
}

export function buildTempLogCsv(logTemp: LogTemp[]): string {
  const header = "frigo,temp,quando,operatore,id";
  const lines = [header];
  for (const t of logTemp) {
    lines.push(
      [
        escCsv(t.nome),
        escCsv(t.temp),
        escCsv(new Date(t.ts).toLocaleString("it-IT")),
        escCsv(t.operatore),
        escCsv(t.id),
      ].join(",")
    );
  }
  return lines.join("\n");
}

export function stampaReportPeriodo(scontrini: ScontrinoCassa[], label: string) {
  const totale = scontrini.reduce((a, s) => a + (Number(s.totale) || 0), 0);
  const mance = scontrini.reduce((a, s) => a + (Number(s.mancia) || 0), 0);
  const coperti = scontrini.reduce((a, s) => a + (Number(s.coperti) || 0), 0);
  const top = topProdotti(scontrini, 8);
  const ore = orariPunta(scontrini).slice(0, 8);
  const topHtml = top.length
    ? top.map((t) => `<tr><td>${t.nome}</td><td style="text-align:right">×${t.qta}</td></tr>`).join("")
    : `<tr><td colspan="2">Nessun prodotto</td></tr>`;
  const oreHtml = ore.length
    ? ore.map((o) => `<tr><td>${o.label}</td><td style="text-align:right">${o.count} · €${o.totale.toFixed(0)}</td></tr>`).join("")
    : `<tr><td colspan="2">Nessun orario</td></tr>`;
  const html = `<!doctype html><html><head><meta charset="utf-8"/><title>Report</title>
<style>body{font-family:system-ui,sans-serif;padding:24px;max-width:640px;margin:0 auto}h1{font-size:20px}table{width:100%;border-collapse:collapse;margin:12px 0}td,th{border-bottom:1px solid #ddd;padding:6px;text-align:left;font-size:13px}.kpi{display:flex;gap:16px;flex-wrap:wrap}.kpi div{background:#f5f5f5;padding:12px 16px;border-radius:12px}</style></head><body>
<h1>Report vendite — ${label}</h1>
<p>${new Date().toLocaleString("it-IT")}</p>
<div class="kpi">
  <div><b>Totale</b><br/>€${totale.toFixed(2)}</div>
  <div><b>Scontrini</b><br/>${scontrini.length}</div>
  <div><b>Coperti</b><br/>${coperti}</div>
  <div><b>Mance</b><br/>€${mance.toFixed(2)}</div>
</div>
<h2>Top prodotti</h2>
<table><thead><tr><th>Prodotto</th><th>Qty</th></tr></thead><tbody>${topHtml}</tbody></table>
<h2>Orari di punta</h2>
<table><thead><tr><th>Ora</th><th>Volume</th></tr></thead><tbody>${oreHtml}</tbody></table>
<script>window.onload=()=>setTimeout(()=>window.print(),300)</script>
</body></html>`;
  return apriStampa(html);
}
