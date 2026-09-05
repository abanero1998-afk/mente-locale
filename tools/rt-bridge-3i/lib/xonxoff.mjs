/**
 * 3i XON/XOFF Rev 1.5 — encode comandi + client TCP con flow control.
 * Charset: printable ASCII 0x20-0x7F. Prezzi in centesimi + suffisso H.
 */

import net from "node:net";

export const XON = 0x11;
export const XOFF = 0x13;
export const DEFAULT_RT_HOST = "192.168.1.60";
export const DEFAULT_RT_PORT = 1723;
export const DEFAULT_DEPT = 1;

const ACCENT_MAP = {
  à: "a",
  á: "a",
  â: "a",
  ä: "a",
  è: "e",
  é: "e",
  ê: "e",
  ë: "e",
  ì: "i",
  í: "i",
  î: "i",
  ï: "i",
  ò: "o",
  ó: "o",
  ô: "o",
  ö: "o",
  ù: "u",
  ú: "u",
  û: "u",
  ü: "u",
  À: "A",
  Á: "A",
  Â: "A",
  Ä: "A",
  È: "E",
  É: "E",
  Ê: "E",
  Ë: "E",
  Ì: "I",
  Í: "I",
  Î: "I",
  Ï: "I",
  Ò: "O",
  Ó: "O",
  Ô: "O",
  Ö: "O",
  Ù: "U",
  Ú: "U",
  Û: "U",
  Ü: "U",
  ñ: "n",
  Ñ: "N",
  ç: "c",
  Ç: "C",
  "°": " ",
  "€": "E",
  "’": "'",
  "‘": "'",
  "“": " ",
  "”": " ",
  "–": "-",
  "—": "-",
};

/** Strip quotes, max 38 chars, ASCII-ish (replace accented). */
export function escapeDescription(nome, maxLen = 38) {
  let s = String(nome ?? "");
  for (const [k, v] of Object.entries(ACCENT_MAP)) {
    s = s.split(k).join(v);
  }
  s = s.replace(/["']/g, "").replace(/[^\x20-\x7E]/g, " ").replace(/\s+/g, " ").trim();
  if (s.length > maxLen) s = s.slice(0, maxLen).trim();
  return s || "ARTICOLO";
}

/** EUR → centesimi interi (arrotondamento bancario-ish). */
export function eurToCents(eur) {
  const n = Number(eur);
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100);
}

/** `"DESC"{cents}H{dept}R` o con qty `"DESC"{qty}*{cents}H{dept}R` */
export function buildSaleCommand({ nome, qta = 1, prezzoEur, reparto = DEFAULT_DEPT }) {
  const desc = escapeDescription(nome);
  const cents = eurToCents(prezzoEur);
  const dept = Math.max(1, Math.min(99, Number(reparto) || DEFAULT_DEPT));
  const qty = Number(qta);
  if (!Number.isFinite(qty) || qty <= 0) {
    throw new Error(`Quantità non valida: ${qta}`);
  }
  if (cents < 0) throw new Error(`Prezzo negativo: ${prezzoEur}`);
  if (Math.abs(qty - 1) < 1e-9) {
    return `"${desc}"${cents}H${dept}R`;
  }
  // qty intero se possibile, altrimenti stringa
  const qtyStr = Number.isInteger(qty) ? String(qty) : String(qty);
  return `"${desc}"${qtyStr}*${cents}H${dept}R`;
}

/** Map pagamento tipo → comando 1T/3T/4T (con o senza importo in centesimi+H). */
export function buildPaymentCommand({ tipo, importo }) {
  const t = String(tipo || "contanti").toLowerCase();
  let code = "1T"; // contanti / misto / default
  if (t === "carta" || t === "satispay" || t === "altro") code = "3T";
  if (t === "buoni") code = "4T";
  if (t === "misto") code = "1T";
  const cents = eurToCents(importo);
  if (cents > 0) return `${cents}H${code}`;
  return code;
}

/**
 * Sequenza scontrino:
 * 1. K clear
 * 2. opzionale c (sale key)
 * 3. righe vendita
 * 4. opzionale =
 * 5. pagamenti
 */
export function buildScontrinoCommands({
  righe = [],
  pagamenti = [],
  includeSaleKey = false,
  includeSubtotal = false,
  defaultReparto = DEFAULT_DEPT,
} = {}) {
  const commands = ["K"];
  if (includeSaleKey) commands.push("c");
  for (const r of righe) {
    commands.push(
      buildSaleCommand({
        nome: r.nome,
        qta: r.qta ?? 1,
        prezzoEur: r.prezzo,
        reparto: r.reparto ?? defaultReparto,
      })
    );
  }
  if (includeSubtotal) commands.push("=");
  const pays =
    pagamenti.length > 0
      ? pagamenti
      : [
          {
            tipo: "contanti",
            importo: righe.reduce((a, r) => a + Number(r.qta || 1) * Number(r.prezzo || 0), 0),
          },
        ];
  for (const p of pays) {
    commands.push(buildPaymentCommand(p));
  }
  return commands;
}

/**
 * Client TCP con XON/XOFF: in pausa scrittura su XOFF, riprende su XON.
 */
export function createXonXoffClient({
  host = DEFAULT_RT_HOST,
  port = DEFAULT_RT_PORT,
  timeoutMs = 10000,
} = {}) {
  let socket = null;
  let canWrite = true;
  const chunks = [];
  let resolveWait;
  let rejectWait;
  let idleTimer;

  function bumpIdle(ms) {
    if (idleTimer) clearTimeout(idleTimer);
    if (ms > 0) {
      idleTimer = setTimeout(() => {
        if (resolveWait) {
          const r = resolveWait;
          resolveWait = null;
          rejectWait = null;
          r(Buffer.concat(chunks).toString("latin1"));
        }
      }, ms);
    }
  }

  function connect() {
    return new Promise((resolve, reject) => {
      const s = net.connect({ host, port }, () => {
        socket = s;
        resolve();
      });
      s.setTimeout(timeoutMs);
      s.on("timeout", () => {
        s.destroy();
        reject(new Error(`Timeout TCP ${host}:${port}`));
      });
      s.on("error", (err) => reject(err));
      s.on("data", (buf) => {
        for (const b of buf) {
          if (b === XOFF) {
            canWrite = false;
            continue;
          }
          if (b === XON) {
            canWrite = true;
            continue;
          }
          chunks.push(Buffer.from([b]));
        }
        if (resolveWait) bumpIdle(80);
      });
      s.on("close", () => {
        socket = null;
        if (rejectWait) {
          const r = rejectWait;
          resolveWait = null;
          rejectWait = null;
          r(new Error("Connessione RT chiusa"));
        }
      });
    });
  }

  async function waitWritable(maxMs = 5000) {
    const start = Date.now();
    while (!canWrite) {
      if (Date.now() - start > maxMs) throw new Error("XOFF prolungato (flow control)");
      await new Promise((r) => setTimeout(r, 20));
    }
  }

  async function writeRaw(str) {
    if (!socket) throw new Error("Non connesso");
    const data = Buffer.from(String(str), "ascii");
    let offset = 0;
    while (offset < data.length) {
      await waitWritable();
      const slice = data.subarray(offset, Math.min(offset + 64, data.length));
      await new Promise((resolve, reject) => {
        socket.write(slice, (err) => (err ? reject(err) : resolve()));
      });
      offset += slice.length;
    }
  }

  async function sendCommand(cmd, { settleMs = 120 } = {}) {
    await writeRaw(cmd);
    // breve attesa risposta/echo
    await new Promise((r) => setTimeout(r, settleMs));
  }

  function readAccumulated() {
    return Buffer.concat(chunks).toString("latin1");
  }

  function waitMore(ms = 300) {
    return new Promise((resolve, reject) => {
      resolveWait = resolve;
      rejectWait = reject;
      bumpIdle(ms);
    });
  }

  function close() {
    if (idleTimer) clearTimeout(idleTimer);
    if (socket) {
      try {
        socket.destroy();
      } catch {
        /* ignore */
      }
      socket = null;
    }
  }

  return {
    connect,
    sendCommand,
    writeRaw,
    readAccumulated,
    waitMore,
    close,
    get host() {
      return host;
    },
    get port() {
      return port;
    },
  };
}

/** Probe: TCP + 89F (status ~39 chars + CR LF). */
export async function probeRt({ host, port, timeoutMs = 8000 } = {}) {
  const client = createXonXoffClient({ host, port, timeoutMs });
  try {
    await client.connect();
    await client.sendCommand("89F", { settleMs: 200 });
    let raw = client.readAccumulated();
    try {
      raw = (await client.waitMore(400)) || raw;
    } catch {
      /* timeout ok */
    }
    return { ok: true, raw: raw || "", status: raw.trim() || null };
  } finally {
    client.close();
  }
}

/** Esegue sequenza comandi sullo RT. */
export async function runCommands(commands, { host, port, timeoutMs = 15000, footerWaitMs = 500 } = {}) {
  const client = createXonXoffClient({ host, port, timeoutMs });
  try {
    await client.connect();
    for (const cmd of commands) {
      await client.sendCommand(cmd, { settleMs: 100 });
    }
    let raw = client.readAccumulated();
    try {
      const more = await client.waitMore(footerWaitMs);
      if (more) raw = more;
    } catch {
      /* ok */
    }
    return { ok: true, raw: raw || "", commands };
  } finally {
    client.close();
  }
}
