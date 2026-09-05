/**
 * Adapter 3i XonXoff (TCP) — es. A8010V su porta 1723.
 * Su Vercel il browser non raggiunge la LAN: usare bridgeUrl (PC con tools/rt-bridge-3i).
 * Software layer verso RT: NON è certificazione fiscale.
 */
import type { FiscalReceiptResult, RtConfig } from "./types";
import type { FiscalDoc } from "./epson-fpmate";

export const XONXOFF_3I_DEFAULT_PORT = 1723;

export function default3iXonxoffRt(partial?: Partial<RtConfig>): RtConfig {
  return {
    enabled: true,
    vendor: "3i_xonxoff",
    host: "",
    port: XONXOFF_3I_DEFAULT_PORT,
    path: "/",
    devid: "A8010V",
    timeoutMs: 10000,
    useHttps: false,
    hardwareModel: "A8010V",
    bridgeUrl: "",
    ...partial,
  };
}

/** Normalize bridge base URL (no trailing slash). */
function normalizeBridgeUrl(url: string): string {
  return url.trim().replace(/\/+$/, "");
}

/** Probe via bridge HTTP, oppure tcp_probe self-host se bridgeUrl assente. */
export async function test3iXonxoffConnection(rt: RtConfig): Promise<FiscalReceiptResult> {
  const bridge = normalizeBridgeUrl(rt.bridgeUrl || "");
  if (bridge) {
    try {
      const res = await fetch(`${bridge}/probe`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          host: rt.host || undefined,
          port: Number(rt.port) || XONXOFF_3I_DEFAULT_PORT,
          timeoutMs: Math.max(1000, Number(rt.timeoutMs) || 10000),
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
        protocollo?: string;
        raw?: string;
        status?: string;
      };
      if (res.ok && data.ok) {
        return {
          ok: true,
          protocollo: data.protocollo || data.status || `BRIDGE-${bridge}`,
          dataOra: new Date().toISOString(),
        };
      }
      return {
        ok: false,
        error: data.error || `Bridge non risponde su ${bridge}/probe`,
      };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return {
        ok: false,
        error: `Bridge irraggiungibile (${bridge}): ${msg}. Tablet e PC devono essere sulla stessa Wi-Fi.`,
      };
    }
  }

  if (!rt.host?.trim()) {
    return {
      ok: false,
      error:
        "Imposta Bridge URL (PC in LAN con tools/rt-bridge-3i) in FISCALE/RT — su Vercel non si raggiunge l'RT direttamente",
    };
  }

  const port = Number(rt.port) || XONXOFF_3I_DEFAULT_PORT;
  const timeoutMs = Math.max(1000, Number(rt.timeoutMs) || 10000);
  try {
    const res = await fetch("/api/fiscal/rt", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        host: rt.host,
        port,
        timeoutMs,
        mode: "tcp_probe",
        xml: "probe",
        vendor: "3i_xonxoff",
      }),
    });
    const data = (await res.json().catch(() => ({}))) as {
      ok?: boolean;
      error?: string;
      protocollo?: string;
    };
    if (res.ok && data.ok) {
      return {
        ok: true,
        protocollo: data.protocollo || `TCP-${rt.host}:${port}`,
        dataOra: new Date().toISOString(),
      };
    }
    return {
      ok: false,
      error:
        data.error ||
        `3i XonXoff non raggiungibile su ${rt.host}:${port}. Su Vercel imposta Bridge URL (PC LAN).`,
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return {
      ok: false,
      error: `Probe TCP 3i fallito: ${msg}. Imposta Bridge URL (PC in LAN con tools/rt-bridge-3i).`,
    };
  }
}

/**
 * Emissione scontrino via bridge HTTP /scontrino.
 * Senza bridgeUrl: errore chiaro (Vercel non raggiunge la LAN).
 */
export async function emit3iXonxoffScontrino(
  doc: FiscalDoc,
  rt: RtConfig
): Promise<FiscalReceiptResult> {
  if (!doc.righe.length) {
    return { ok: false, error: "Nessuna riga da fiscalizzare" };
  }

  const bridge = normalizeBridgeUrl(rt.bridgeUrl || "");
  if (!bridge) {
    return {
      ok: false,
      error:
        "Imposta Bridge URL (PC in LAN con tools/rt-bridge-3i) in FISCALE/RT",
    };
  }

  const righe = doc.righe.map((r) => ({
    nome: r.nome,
    qta: r.qta,
    prezzo: r.prezzo,
    reparto: r.reparto ?? 1,
  }));
  const pagamenti =
    doc.pagamenti?.length > 0
      ? doc.pagamenti.map((p) => ({ tipo: p.tipo, importo: p.importo }))
      : [
          {
            tipo: "contanti" as const,
            importo: doc.righe.reduce((a, r) => a + r.qta * r.prezzo, 0),
          },
        ];

  try {
    const res = await fetch(`${bridge}/scontrino`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        righe,
        pagamenti,
        dryRun: false,
        host: rt.host || undefined,
        port: Number(rt.port) || XONXOFF_3I_DEFAULT_PORT,
        timeoutMs: Math.max(1000, Number(rt.timeoutMs) || 10000),
      }),
    });
    const data = (await res.json().catch(() => ({}))) as {
      ok?: boolean;
      protocollo?: string;
      error?: string;
      commands?: string[];
      raw?: string;
    };
    if (res.ok && data.ok) {
      return {
        ok: true,
        protocollo: data.protocollo || `3I-${Date.now().toString(36).toUpperCase()}`,
        dataOra: new Date().toISOString(),
      };
    }
    return {
      ok: false,
      error: data.error || `Bridge /scontrino HTTP ${res.status}`,
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return {
      ok: false,
      error: `Bridge scontrino fallito (${bridge}): ${msg}`,
    };
  }
}
