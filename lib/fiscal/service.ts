/**
 * Servizio emissione scontrino fiscale — adapter RT.
 * Demo solo se rt.vendor === 'demo' (o bundle.demoNonFiscale gestito dal caller).
 */

import { emitEpsonScontrino, type FiscalDoc } from "./epson-fpmate";
import { emit3iXonxoffScontrino } from "./xonxoff-3i";
import type {
  FiscalBundle,
  FiscalPagamento,
  FiscalReceiptResult,
  FiscalRiga,
  RtConfig,
} from "./types";

export type EmitScontrinoInput = {
  righe: FiscalRiga[];
  pagamenti: FiscalPagamento[];
  profilo: FiscalBundle["profilo"];
  rt: RtConfig;
  operatore?: string;
};

async function emitCustomHttp(doc: FiscalDoc, rt: RtConfig): Promise<FiscalReceiptResult> {
  if (!rt.host?.trim()) return { ok: false, error: "Host custom_http non configurato" };
  const proto = rt.useHttps ? "https" : "http";
  const port = rt.port || (rt.useHttps ? 443 : 80);
  const path = (rt.path || "/").startsWith("/") ? rt.path || "/" : `/${rt.path}`;
  const url = `${proto}://${rt.host}:${port}${path}`;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        profilo: doc.profilo,
        righe: doc.righe,
        pagamenti: doc.pagamenti,
        operatore: doc.operatore,
      }),
    });
    const data = (await res.json().catch(() => ({}))) as FiscalReceiptResult;
    if (!res.ok) return { ok: false, error: data.error || `custom_http HTTP ${res.status}` };
    return {
      ok: !!data.ok,
      protocollo: data.protocollo,
      dataOra: data.dataOra || new Date().toISOString(),
      error: data.error,
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    // fallback proxy
    try {
      const res = await fetch("/api/fiscal/rt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          host: rt.host,
          port: rt.port,
          path: rt.path,
          devid: rt.devid,
          timeoutMs: rt.timeoutMs,
          useHttps: rt.useHttps,
          xml: JSON.stringify(doc),
          mode: "custom_json",
        }),
      });
      const data = (await res.json().catch(() => ({}))) as FiscalReceiptResult & { body?: string };
      if (data.ok) return { ok: true, protocollo: data.protocollo, dataOra: new Date().toISOString() };
      return { ok: false, error: data.error || msg };
    } catch {
      return { ok: false, error: `custom_http non raggiungibile: ${msg}` };
    }
  }
}

function emitDemo(doc: FiscalDoc): FiscalReceiptResult {
  const tot = doc.righe.reduce((a, r) => a + r.qta * r.prezzo, 0);
  return {
    ok: true,
    demo: true,
    protocollo: `DEMO-${Date.now().toString(36).toUpperCase()}`,
    dataOra: new Date().toISOString(),
    error: tot < 0 ? "Totale negativo" : undefined,
  };
}

/**
 * Emette scontrino sul RT configurato.
 * Adapter demo SOLO se rt.vendor === 'demo'.
 */
export async function emitScontrinoFiscale(input: EmitScontrinoInput): Promise<FiscalReceiptResult> {
  const doc: FiscalDoc = {
    profilo: input.profilo,
    righe: input.righe,
    pagamenti: input.pagamenti,
    operatore: input.operatore,
  };

  if (!input.righe.length) {
    return { ok: false, error: "Nessuna riga da fiscalizzare" };
  }

  if (input.rt.vendor === "demo") {
    return emitDemo(doc);
  }

  if (input.rt.vendor === "custom_http") {
    return emitCustomHttp(doc, input.rt);
  }

  if (input.rt.vendor === "3i_xonxoff") {
    return emit3iXonxoffScontrino(doc, input.rt);
  }

  // epson_fpmate (default)
  return emitEpsonScontrino(doc, input.rt);
}
