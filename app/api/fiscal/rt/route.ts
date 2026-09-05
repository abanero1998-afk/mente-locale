import { NextResponse } from "next/server";

/**
 * Proxy server-side verso Registratore Telematico in LAN.
 *
 * Perché esiste:
 * - Il browser spesso blocca fetch cross-origin verso IP privati (CORS).
 * - Su Vercel/cloud il server NON raggiunge la LAN del locale:
 *   serve self-host sull'Wi-Fi del ristorante, oppure reverse-proxy locale.
 * - Su self-host Next, questa route inoltra XML/JSON solo a IP privati.
 *
 * Flusso client consigliato: prova fetch diretto al RT; se CORS fallisce, POST qui.
 */

function isPrivateIp(host: string): boolean {
  const h = (host || "").trim().toLowerCase();
  if (!h) return false;
  if (h === "localhost" || h === "127.0.0.1" || h === "::1") return true;
  const m = h.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!m) return false;
  const a = Number(m[1]);
  const b = Number(m[2]);
  if (a === 10) return true;
  if (a === 192 && b === 168) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 127) return true;
  return false;
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const host = String(body?.host || "").trim();
    const port = Number(body?.port) || 80;
    const pathRaw = String(body?.path || "/cgi-bin/fpmate.cgi");
    const path = pathRaw.startsWith("/") ? pathRaw : `/${pathRaw}`;
    const devid = encodeURIComponent(String(body?.devid || "local_printer"));
    const timeoutMs = Math.max(1000, Number(body?.timeoutMs) || 10000);
    const useHttps = !!body?.useHttps;
    const xml = String(body?.xml || "");
    const mode = String(body?.mode || "fpmate");

    if (!host || !isPrivateIp(host)) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Host non consentito: solo IP privati (192.168/10/172.16–31) o localhost. Su cloud (Vercel) il RT LAN non è raggiungibile — self-host in sede o reverse-proxy.",
        },
        { status: 400 }
      );
    }

    // 3i XonXoff / A8010V: raw TCP reachability (porta tipica 1723).
    if (mode === "tcp_probe") {
      const net = await import("net");
      const ok = await new Promise<{ ok: boolean; error?: string }>((resolve) => {
        const socket = net.createConnection({ host, port }, () => {
          socket.end();
          resolve({ ok: true });
        });
        socket.setTimeout(timeoutMs);
        socket.on("timeout", () => {
          socket.destroy();
          resolve({ ok: false, error: `Timeout TCP ${host}:${port}` });
        });
        socket.on("error", (e: Error) => {
          resolve({ ok: false, error: e.message || `TCP error ${host}:${port}` });
        });
      });
      if (!ok.ok) {
        return NextResponse.json(
          {
            ok: false,
            error: `Probe TCP fallito (${host}:${port}): ${ok.error}. Su Vercel la LAN non è raggiungibile — self-host in sede.`,
          },
          { status: 502 }
        );
      }
      return NextResponse.json({
        ok: true,
        protocollo: `TCP-OK-${host}:${port}`,
        note: "TCP reachable. Protocollo XonXoff richiede bridge per emissione scontrino.",
      });
    }

    if (!xml) {
      return NextResponse.json({ ok: false, error: "Body XML/payload mancante" }, { status: 400 });
    }

    const proto = useHttps ? "https" : "http";
    const url =
      mode === "custom_json"
        ? `${proto}://${host}:${port}${path}`
        : `${proto}://${host}:${port}${path}?devid=${devid}&timeout=${timeoutMs}`;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs + 2000);

    try {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type":
            mode === "custom_json" ? "application/json" : "text/xml; charset=utf-8",
        },
        body: xml,
        signal: controller.signal,
      });
      const text = await res.text();
      const success =
        /success\s*=\s*"true"/i.test(text) ||
        /"ok"\s*:\s*true/i.test(text) ||
        (res.ok && mode === "custom_json");

      const protoMatch =
        text.match(/fiscalReceiptNumber[^>]*>([^<]+)/i) ||
        text.match(/fiscalReceiptNumber\s*=\s*"([^"]+)"/i) ||
        text.match(/"protocollo"\s*:\s*"([^"]+)"/i);

      return NextResponse.json({
        ok: success || res.ok,
        status: res.status,
        body: text,
        protocollo: protoMatch?.[1]?.trim(),
        note:
          "Proxy LAN OK. Su Vercel questo endpoint non raggiunge il RT: usa Next self-host in locale.",
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return NextResponse.json(
        {
          ok: false,
          error: `Proxy non raggiunge RT (${host}:${port}): ${msg}. Verifica self-host sulla stessa rete del registratore.`,
        },
        { status: 502 }
      );
    } finally {
      clearTimeout(timer);
    }
  } catch {
    return NextResponse.json({ ok: false, error: "Richiesta non valida" }, { status: 400 });
  }
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    docs:
      "POST { host, port, path, devid, timeoutMs, useHttps, xml } → inoltra a RT privato. Client: prova fetch diretto; se CORS, usa questo proxy (solo self-host LAN).",
  });
}
