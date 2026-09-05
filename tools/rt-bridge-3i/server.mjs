/**
 * Bridge HTTP LAN -> 3i Acapulco A8010V (XON/XOFF TCP :1723).
 * Browser (also on Vercel) calls this on PC/Raspberry on Wi-Fi with the RT.
 * Software layer — NOT certified fiscal install. Verify first receipts on real RT.
 */

import http from "node:http";
import {
  DEFAULT_RT_HOST,
  DEFAULT_RT_PORT,
  buildScontrinoCommands,
  probeRt,
  runCommands,
} from "./lib/xonxoff.mjs";

const BRIDGE_PORT = Number(process.env.BRIDGE_PORT) || 8787;
const RT_HOST = process.env.RT_HOST || DEFAULT_RT_HOST;
const RT_PORT = Number(process.env.RT_PORT) || DEFAULT_RT_PORT;
const BRIDGE_TOKEN = (process.env.BRIDGE_TOKEN || "").trim();
const DEFAULT_DEPT = Number(process.env.RT_DEFAULT_DEPT) || 1;

function cors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
}

function json(res, status, body) {
  cors(res);
  const raw = JSON.stringify(body);
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(raw);
}

function checkAuth(req) {
  if (!BRIDGE_TOKEN) return true;
  const h = req.headers.authorization || "";
  if (h === `Bearer ${BRIDGE_TOKEN}`) return true;
  const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);
  if (url.searchParams.get("token") === BRIDGE_TOKEN) return true;
  return false;
}

async function readBody(req) {
  const chunks = [];
  for await (const c of req) chunks.push(c);
  const raw = Buffer.concat(chunks).toString("utf8");
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    throw new Error("JSON body non valido");
  }
}

function protocolloNow() {
  return `3I-${Date.now().toString(36).toUpperCase()}`;
}

const server = http.createServer(async (req, res) => {
  cors(res);
  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);
  const path = url.pathname.replace(/\/+$/, "") || "/";

  try {
    if (req.method === "GET" && path === "/health") {
      json(res, 200, {
        ok: true,
        rtHost: RT_HOST,
        rtPort: RT_PORT,
        bridgePort: BRIDGE_PORT,
        note: "Software layer — non sostituto di installazione certificata",
      });
      return;
    }

    if (!checkAuth(req) && path !== "/health") {
      json(res, 401, { ok: false, error: "Unauthorized (BRIDGE_TOKEN)" });
      return;
    }

    if (req.method === "POST" && path === "/probe") {
      const body = await readBody(req).catch(() => ({}));
      const host = body.host || RT_HOST;
      const port = Number(body.port) || RT_PORT;
      try {
        const result = await probeRt({
          host,
          port,
          timeoutMs: Number(body.timeoutMs) || 8000,
        });
        json(res, 200, {
          ok: true,
          host,
          port,
          raw: result.raw,
          status: result.status,
          protocollo: protocolloNow(),
        });
      } catch (e) {
        json(res, 200, {
          ok: false,
          host,
          port,
          error: e instanceof Error ? e.message : String(e),
        });
      }
      return;
    }

    if (req.method === "POST" && path === "/scontrino") {
      const body = await readBody(req);
      const righe = Array.isArray(body.righe) ? body.righe : [];
      const pagamenti = Array.isArray(body.pagamenti) ? body.pagamenti : [];
      const dryRun = !!body.dryRun;
      const host = body.host || RT_HOST;
      const port = Number(body.port) || RT_PORT;

      if (!righe.length) {
        json(res, 400, { ok: false, error: "Nessuna riga (righe[])", commands: [] });
        return;
      }

      let commands;
      try {
        commands = buildScontrinoCommands({
          righe,
          pagamenti,
          includeSaleKey: !!body.includeSaleKey,
          includeSubtotal: !!body.includeSubtotal,
          defaultReparto: Number(body.defaultReparto) || DEFAULT_DEPT,
        });
      } catch (e) {
        json(res, 400, {
          ok: false,
          error: e instanceof Error ? e.message : String(e),
          commands: [],
        });
        return;
      }

      if (dryRun) {
        json(res, 200, {
          ok: true,
          dryRun: true,
          protocollo: protocolloNow(),
          commands,
          raw: "",
        });
        return;
      }

      try {
        const result = await runCommands(commands, {
          host,
          port,
          timeoutMs: Number(body.timeoutMs) || 15000,
          footerWaitMs: Number(body.footerWaitMs) || 500,
        });
        json(res, 200, {
          ok: true,
          protocollo: protocolloNow(),
          commands: result.commands,
          raw: result.raw,
        });
      } catch (e) {
        json(res, 200, {
          ok: false,
          protocollo: undefined,
          commands,
          raw: "",
          error: e instanceof Error ? e.message : String(e),
        });
      }
      return;
    }

    json(res, 404, {
      ok: false,
      error: "Not found. Endpoints: GET /health, POST /probe, POST /scontrino",
    });
  } catch (e) {
    json(res, 500, { ok: false, error: e instanceof Error ? e.message : String(e) });
  }
});

server.listen(BRIDGE_PORT, "0.0.0.0", () => {
  console.log(
    `[rt-bridge-3i] http://0.0.0.0:${BRIDGE_PORT} -> RT ${RT_HOST}:${RT_PORT} (token=${BRIDGE_TOKEN ? "on" : "off"})`
  );
  console.log(
    "[rt-bridge-3i] Layer software — verifica i primi scontrini sull RT reale. demoNonFiscale per test offline."
  );
});
