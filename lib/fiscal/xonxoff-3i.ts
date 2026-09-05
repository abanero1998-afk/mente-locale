/**
 * Adapter 3i XonXoff (TCP) — es. A8010V su porta 1723.
 * Software layer verso RT in LAN: NON è certificazione fiscale.
 * Il protocollo nativo è seriale/TCP XON-XOFF (non HTTP CGI Epson).
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
    ...partial,
  };
}

/** TCP reachability probe via self-host API (browser cannot open raw sockets). */
export async function test3iXonxoffConnection(rt: RtConfig): Promise<FiscalReceiptResult> {
  if (!rt.host?.trim()) {
    return { ok: false, error: "Host RT 3i non configurato" };
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
        `3i XonXoff non raggiungibile su ${rt.host}:${port} (serve Next self-host in LAN)`,
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return {
      ok: false,
      error: `Probe TCP 3i fallito: ${msg}. Apri l'app self-host sulla Wi-Fi del locale.`,
    };
  }
}

/**
 * Emissione: probe TCP + messaggio chiaro.
 * Il framing completo XonXoff richiede bridge dedicato; non simuliamo scontrino fiscale.
 */
export async function emit3iXonxoffScontrino(
  doc: FiscalDoc,
  rt: RtConfig
): Promise<FiscalReceiptResult> {
  if (!doc.righe.length) {
    return { ok: false, error: "Nessuna riga da fiscalizzare" };
  }
  const probe = await test3iXonxoffConnection(rt);
  if (!probe.ok) return probe;
  return {
    ok: false,
    error:
      "RT 3i XonXoff raggiungibile in TCP, ma l'emissione scontrino richiede il bridge protocollo (non certificato in-app). Hardware A8010V configurato; completa con driver/bridge locale.",
  };
}
