export function ticketHtml(opts: {
  tipo: "COMANDA CUCINA" | "COMANDA BAR" | "PRECONTO" | "SCONTRINO";
  tavolo: string;
  ora: string;
  operatore?: string;
  righe: { nome: string; qta: number; prezzo?: number; nota?: string }[];
  totale?: number;
  locale?: string;
}) {
  const righe = opts.righe
    .map((r) => {
      const px = typeof r.prezzo === "number" ? `  €${(r.prezzo * r.qta).toFixed(2)}` : "";
      const nota = r.nota?.trim()
        ? `<div class="n">${r.nota.trim().replace(/</g, "&lt;").replace(/>/g, "&gt;")}</div>`
        : "";
      return `<div class="r"><b>${r.qta}x</b> ${r.nome}${px}${nota}</div>`;
    })
    .join("");
  const tot = typeof opts.totale === "number" ? `<div class="tot">TOTALE €${opts.totale.toFixed(2)}</div>` : "";
  return `<!doctype html><html><head><meta charset="utf-8"/><title>${opts.tipo}</title>
<style>body{font-family:ui-monospace,Menlo,monospace;width:280px;margin:12px}h1{font-size:16px;margin:0 0 6px}.m{font-size:11px}.r{font-size:13px;border-bottom:1px dashed #999;padding:4px 0}.n{font-size:11px;font-style:italic;opacity:.85;margin-top:2px}.tot{font-size:16px;font-weight:800;margin-top:10px}</style></head><body>
<h1>${opts.locale || "MENTE LOCALE"}</h1>
<div class="m">${opts.tipo}</div>
<div class="m">${opts.tavolo} · ${opts.ora}${opts.operatore ? " · " + opts.operatore : ""}</div>
<hr/>${righe}${tot}
<div class="m" style="margin-top:12px">Non fiscale</div>
<script>window.onload=()=>setTimeout(()=>window.print(),200)</script></body></html>`;
}

export function apriStampa(html: string) {
  const w = window.open("", "_blank", "width=360,height=640");
  if (!w) return false;
  w.document.write(html);
  w.document.close();
  return true;
}
