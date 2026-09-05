function esc(s: string) {
  return String(s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function ticketHtml(opts: {
  tipo: "COMANDA CUCINA" | "COMANDA BAR" | "PRECONTO" | "SCONTRINO";
  tavolo: string;
  ora: string;
  operatore?: string;
  righe: { nome: string; qta: number; prezzo?: number; nota?: string; note?: string }[];
  totale?: number;
  subtotale?: number;
  sconto?: number;
  mancia?: number;
  pagamento?: string;
  splitLines?: { label: string; importo: number; pagamento?: string }[];
  riferimentoPos?: string;
  noteFiscali?: string;
  locale?: string;
  /** Header fiscale (solo se RT ok / scontrino fiscale). */
  fiscale?: boolean;
  partitaIva?: string;
  ragioneSociale?: string;
  indirizzoFiscale?: string;
  rtProtocollo?: string;
}) {
  const righe = opts.righe
    .map((r) => {
      const px = typeof r.prezzo === "number" ? `  €${(r.prezzo * r.qta).toFixed(2)}` : "";
      const rawNota = (r.nota || r.note || "").trim();
      const nota = rawNota ? `<div class="n">${esc(rawNota)}</div>` : "";
      return `<div class="r"><b>${esc(String(r.qta))}x</b> ${esc(r.nome)}${px}${nota}</div>`;
    })
    .join("");

  const extras: string[] = [];
  if (typeof opts.subtotale === "number") {
    extras.push(`<div class="m">Subtotale €${opts.subtotale.toFixed(2)}</div>`);
  }
  if (typeof opts.sconto === "number" && opts.sconto > 0) {
    extras.push(`<div class="m">Sconto -€${opts.sconto.toFixed(2)}</div>`);
  }
  if (typeof opts.mancia === "number" && opts.mancia > 0) {
    extras.push(`<div class="m">Mancia €${opts.mancia.toFixed(2)}</div>`);
  }
  if (opts.pagamento) {
    extras.push(`<div class="m">Pagamento: ${esc(opts.pagamento)}</div>`);
  }
  if (opts.splitLines?.length) {
    extras.push(`<div class="m" style="margin-top:6px"><b>Split conto</b></div>`);
    for (const s of opts.splitLines) {
      extras.push(
        `<div class="m">${esc(s.label)} · €${s.importo.toFixed(2)}${s.pagamento ? " · " + esc(s.pagamento) : ""}</div>`
      );
    }
  }
  if (opts.riferimentoPos?.trim()) {
    extras.push(`<div class="m">POS auth: ${esc(opts.riferimentoPos.trim())}</div>`);
  }
  if (opts.noteFiscali?.trim()) {
    extras.push(`<div class="n">${esc(opts.noteFiscali.trim())}</div>`);
  }
  if (opts.fiscale && opts.rtProtocollo?.trim()) {
    extras.push(`<div class="m">Prot. RT: ${esc(opts.rtProtocollo.trim())}</div>`);
  }

  const isFiscalReceipt = !!opts.fiscale && opts.tipo === "SCONTRINO";
  const brand = isFiscalReceipt && opts.ragioneSociale?.trim()
    ? opts.ragioneSociale.trim()
    : opts.locale || "MENTE LOCALE";

  const fiscalHeader: string[] = [];
  if (isFiscalReceipt) {
    if (opts.partitaIva?.trim()) {
      fiscalHeader.push(`<div class="m">P.IVA ${esc(opts.partitaIva.trim())}</div>`);
    }
    if (opts.indirizzoFiscale?.trim()) {
      fiscalHeader.push(`<div class="m">${esc(opts.indirizzoFiscale.trim())}</div>`);
    }
  }

  const footer = isFiscalReceipt
    ? `<div class="m" style="margin-top:12px">Documento commerciale fiscale</div>`
    : `<div class="m" style="margin-top:12px">Non fiscale</div>`;

  const tot = typeof opts.totale === "number" ? `<div class="tot">TOTALE €${opts.totale.toFixed(2)}</div>` : "";
  return `<!doctype html><html><head><meta charset="utf-8"/><title>${esc(opts.tipo)}</title>
<style>body{font-family:ui-monospace,Menlo,monospace;width:280px;margin:12px}h1{font-size:16px;margin:0 0 6px}.m{font-size:11px}.r{font-size:13px;border-bottom:1px dashed #999;padding:4px 0}.n{font-size:11px;font-style:italic;opacity:.85;margin-top:2px}.tot{font-size:16px;font-weight:800;margin-top:10px}</style></head><body>
<h1>${esc(brand)}</h1>
${fiscalHeader.join("")}
<div class="m">${esc(opts.tipo)}</div>
<div class="m">${esc(opts.tavolo)} · ${esc(opts.ora)}${opts.operatore ? " · " + esc(opts.operatore) : ""}</div>
<hr/>${righe}${extras.join("")}${tot}
${footer}
<script>window.onload=()=>setTimeout(()=>window.print(),200)</script></body></html>`;
}

export function apriStampa(html: string) {
  const w = window.open("", "_blank", "width=360,height=640");
  if (!w) return false;
  w.document.write(html);
  w.document.close();
  return true;
}
