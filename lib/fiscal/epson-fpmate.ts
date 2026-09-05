/**
 * Adapter Epson FpMate CGI — ePOS Fiscal XML (Italia).
 * Software layer verso RT in LAN: NON è certificazione fiscale.
 */

import type {
  FiscalPagamento,
  FiscalProfile,
  FiscalReceiptResult,
  FiscalRiga,
  RtConfig,
} from "./types";

function escXml(s: string): string {
  return String(s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function trunc(s: string, n: number) {
  const t = (s || "").trim();
  return t.length <= n ? t : t.slice(0, n);
}

function paymentTypeEpson(tipo: FiscalPagamento["tipo"]): number {
  if (tipo === "contanti") return 0;
  if (tipo === "carta" || tipo === "satispay" || tipo === "misto") return 2;
  return 0;
}

function deptFromAliquota(a?: number): number {
  if (a === 22) return 1;
  if (a === 10) return 2;
  if (a === 4) return 3;
  if (a === 0) return 4;
  return 1;
}

export type FiscalDoc = {
  profilo: FiscalProfile;
  righe: FiscalRiga[];
  pagamenti: FiscalPagamento[];
  operatore?: string;
};

/** XML scontrino: printRecItem / printRecTotal / begin-endFiscalReceipt. */
export function buildFiscalXml(doc: FiscalDoc): string {
  const items = doc.righe
    .filter((r) => r.qta > 0 && r.prezzo >= 0)
    .map((r) => {
      const desc = trunc(r.nome, 32);
      const qty = Number(r.qta).toFixed(3);
      const unit = Number(r.prezzo).toFixed(2);
      const dept = deptFromAliquota(r.aliquota ?? doc.profilo.aliquotaDefault);
      return `  <printRecItem description="${escXml(desc)}" quantity="${qty}" unitPrice="${unit}" department="${dept}" justification="1" />`;
    })
    .join("\n");

  const pays =
    doc.pagamenti.length > 0
      ? doc.pagamenti
      : [{ tipo: "contanti" as const, importo: doc.righe.reduce((a, r) => a + r.qta * r.prezzo, 0) }];

  const totals = pays
    .map((p) => {
      const desc = trunc(p.descrizione || p.tipo.toUpperCase(), 32);
      const amt = Number(p.importo).toFixed(2);
      const pt = paymentTypeEpson(p.tipo);
      return `  <printRecTotal description="${escXml(desc)}" payment="${amt}" paymentType="${pt}" index="0" justification="1" />`;
    })
    .join("\n");

  return `<?xml version="1.0" encoding="utf-8"?>
<printerFiscalReceipt>
  <beginFiscalReceipt operator="1" />
${items}
${totals}
  <endFiscalReceipt operator="1" />
</printerFiscalReceipt>`;
}

export function buildPrinterStatusXml(): string {
  return `<?xml version="1.0" encoding="utf-8"?>
<printerCommand>
  <queryPrinterStatus />
</printerCommand>`;
}

export function rtUrl(rt: RtConfig): string {
  const proto = rt.useHttps ? "https" : "http";
  const port = rt.port || (rt.useHttps ? 443 : 80);
  const path = (rt.path || "/cgi-bin/fpmate.cgi").startsWith("/")
    ? rt.path || "/cgi-bin/fpmate.cgi"
    : `/${rt.path}`;
  const timeout = Math.max(1000, Number(rt.timeoutMs) || 10000);
  const devid = encodeURIComponent(rt.devid || "local_printer");
  return `${proto}://${rt.host}:${port}${path}?devid=${devid}&timeout=${timeout}`;
}

export function parseFpMateResponse(text: string): FiscalReceiptResult {
  const raw = String(text || "");
  const success =
    /success\s*=\s*"true"/i.test(raw) ||
    /<success>\s*true\s*<\/success>/i.test(raw) ||
    (/code\s*=\s*"0"/i.test(raw) && !/success\s*=\s*"false"/i.test(raw));

  const protoMatch =
    raw.match(/fiscalReceiptNumber[^>]*>([^<]+)/i) ||
    raw.match(/fiscalReceiptNumber\s*=\s*"([^"]+)"/i) ||
    raw.match(/zRepNumber[^>]*>([^<]+)/i) ||
    raw.match(/protocollo[^>]*>([^<]+)/i);

  const errMatch =
    raw.match(/code\s*=\s*"([^"]+)"/i) ||
    raw.match(/status\s*=\s*"([^"]+)"/i) ||
    raw.match(/<error[^>]*>([^<]+)/i);

  if (success) {
    return {
      ok: true,
      protocollo: protoMatch?.[1]?.trim() || undefined,
      dataOra: new Date().toISOString(),
    };
  }

  const code = errMatch?.[1]?.trim();
  return {
    ok: false,
    error: code
      ? `RT Epson errore (code=${code}). Verifica FpMate e stato stampante.`
      : "Risposta RT non valida o fallita. Controlla IP/porta/FpMate.",
  };
}

export async function postToFpMate(
  rt: RtConfig,
  xml: string,
  opts?: { viaProxy?: boolean }
): Promise<FiscalReceiptResult> {
  if (!rt.host?.trim()) {
    return { ok: false, error: "Host RT non configurato" };
  }

  const url = rtUrl(rt);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), Math.max(3000, rt.timeoutMs || 10000) + 2000);

  try {
    if (opts?.viaProxy) {
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
          xml,
        }),
        signal: controller.signal,
      });
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        body?: string;
        error?: string;
        protocollo?: string;
      };
      if (!res.ok || data.ok === false) {
        return { ok: false, error: data.error || `Proxy RT HTTP ${res.status}` };
      }
      if (data.body) return parseFpMateResponse(data.body);
      if (data.ok) {
        return { ok: true, protocollo: data.protocollo, dataOra: new Date().toISOString() };
      }
      return { ok: false, error: data.error || "Proxy RT senza body" };
    }

    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "text/xml; charset=utf-8" },
      body: xml,
      signal: controller.signal,
      mode: "cors",
    });
    const text = await res.text();
    if (!res.ok) {
      return { ok: false, error: `RT HTTP ${res.status}: ${trunc(text, 120)}` };
    }
    return parseFpMateResponse(text);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (/Failed to fetch|NetworkError|CORS|cors|Load failed/i.test(msg)) {
      return {
        ok: false,
        error:
          "CORS o rete: il browser non raggiunge il RT. Usa proxy /api/fiscal/rt (self-host LAN) oppure apri l'app sulla stessa Wi-Fi con CORS * sul FpMate.",
      };
    }
    if (/abort/i.test(msg)) {
      return { ok: false, error: "Timeout connessione al Registratore Telematico" };
    }
    return { ok: false, error: `RT non raggiungibile: ${msg}` };
  } finally {
    clearTimeout(timer);
  }
}

export async function testConnection(rt: RtConfig): Promise<FiscalReceiptResult> {
  if (rt.vendor === "demo") {
    return { ok: true, demo: true, protocollo: "DEMO-STATUS", dataOra: new Date().toISOString() };
  }
  const xml = buildPrinterStatusXml();
  const direct = await postToFpMate(rt, xml, { viaProxy: false });
  if (direct.ok) return direct;
  const proxied = await postToFpMate(rt, xml, { viaProxy: true });
  if (proxied.ok) return proxied;
  if (direct.error && /CORS|rete|Failed to fetch/i.test(direct.error)) {
    return {
      ok: false,
      error: `${direct.error} | Proxy: ${proxied.error || "fallito"}`,
    };
  }
  return direct.error ? direct : proxied;
}

export async function emitEpsonScontrino(doc: FiscalDoc, rt: RtConfig): Promise<FiscalReceiptResult> {
  const xml = buildFiscalXml(doc);
  const direct = await postToFpMate(rt, xml, { viaProxy: false });
  if (direct.ok) return direct;
  const proxied = await postToFpMate(rt, xml, { viaProxy: true });
  if (proxied.ok) return proxied;
  if (direct.error && /CORS|rete|Failed to fetch|Timeout/i.test(direct.error)) {
    return {
      ok: false,
      error: `${direct.error} — fallback proxy: ${proxied.error || "fallito"}`,
    };
  }
  return direct.error ? direct : proxied;
}
