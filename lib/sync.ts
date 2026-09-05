import type { SyncEvent } from "./types";

function localeId() {
  if (typeof window === "undefined") return "mentelocale";
  try {
    const raw = localStorage.getItem("ml-auth-v1");
    if (!raw) return "mentelocale";
    const parsed = JSON.parse(raw);
    return parsed?.state?.localeId || parsed?.state?.sessione?.localeId || "mentelocale";
  } catch {
    return "mentelocale";
  }
}

function channelName() {
  return `mente-locale-${localeId()}`;
}

export const deviceId =
  typeof window === "undefined"
    ? "ssr"
    : localStorage.getItem("ml-device") ||
      (() => {
        const id = `dev-${Math.random().toString(36).slice(2, 10)}`;
        localStorage.setItem("ml-device", id);
        return id;
      })();

export function deviceIdShort() {
  return String(deviceId).replace(/^dev-/, "").slice(0, 6);
}

const NICK_KEY = "ml-device-nick";

export function getDeviceNick(): string {
  if (typeof window === "undefined") return "Questo device";
  return localStorage.getItem(NICK_KEY) || "Questo device";
}

export function setDeviceNick(nome: string) {
  if (typeof window === "undefined") return;
  localStorage.setItem(NICK_KEY, (nome || "").trim() || "Questo device");
}

function supabaseUrl() {
  return process.env.NEXT_PUBLIC_SUPABASE_URL || "";
}
function supabaseKey() {
  return process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
}
export function supabaseConfigured() {
  return Boolean(supabaseUrl() && supabaseKey());
}

type ChannelLike = {
  on: (type: string, filter: unknown, cb: (payload: { payload: SyncEvent }) => void) => ChannelLike;
  send: (msg: { type: string; event: string; payload: SyncEvent }) => Promise<string>;
  subscribe: () => string | void;
  unsubscribe?: () => void;
};
type ClientLike = {
  from: (table: string) => { insert: (row: Record<string, unknown>) => Promise<{ error: Error | null }> };
  channel: (name: string) => ChannelLike;
  removeChannel?: (ch: ChannelLike) => void;
};

let sb: ClientLike | null = null;
let sbPromise: Promise<ClientLike | null> | null = null;
let remoteUnsub: (() => void) | null = null;
let lastCloudOk = 0;
let lastLocalMsg = 0;

export function getLastCloudOk() {
  return lastCloudOk;
}
export function getLastLocalMsg() {
  return lastLocalMsg;
}
export function markCloudOk() {
  lastCloudOk = Date.now();
}
export function markLocalMsg() {
  lastLocalMsg = Date.now();
}

async function getSupabase(): Promise<ClientLike | null> {
  if (!supabaseConfigured() || typeof window === "undefined") return null;
  if (sb) return sb;
  if (sbPromise) return sbPromise;
  sbPromise = import("@supabase/supabase-js")
    .then((mod) => {
      sb = mod.createClient(supabaseUrl(), supabaseKey()) as unknown as ClientLike;
      return sb;
    })
    .catch(() => null);
  return sbPromise;
}

let local: BroadcastChannel | null =
  typeof window !== "undefined" && "BroadcastChannel" in window ? new BroadcastChannel(channelName()) : null;

export function publishLocal(event: SyncEvent) {
  try {
    local?.postMessage(event);
    markLocalMsg();
  } catch {}
}

export function listenLocal(onEvent: (e: SyncEvent) => void) {
  if (!local) return () => {};
  const handler = (ev: MessageEvent<SyncEvent>) => {
    if (!ev.data?.deviceId || ev.data.deviceId === deviceId) return;
    markLocalMsg();
    onEvent(ev.data);
  };
  local.addEventListener("message", handler);
  return () => local!.removeEventListener("message", handler);
}

export async function publishRemote(event: SyncEvent) {
  const client = await getSupabase();
  if (!client) return false;
  const lid = localeId();
  try {
    await client.from("eventi_ordine").insert({
      id: `${lid}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      locale_id: lid,
      kind: event.kind,
      payload: event,
    });
    await client.channel(`kds-${lid}`).send({ type: "broadcast", event: "sync", payload: event });
    markCloudOk();
    return true;
  } catch {
    return false;
  }
}

export async function listenRemote(onEvent: (e: SyncEvent) => void) {
  const client = await getSupabase();
  if (!client) return () => {};
  const lid = localeId();
  const ch = client.channel(`kds-${lid}`);
  ch.on("broadcast", { event: "sync" }, (payload) => {
    const ev = payload.payload;
    if (ev?.deviceId && ev.deviceId !== deviceId) {
      markCloudOk();
      onEvent(ev);
    }
  });
  ch.subscribe();
  remoteUnsub = () => {
    try {
      ch.unsubscribe?.();
      client.removeChannel?.(ch);
    } catch {}
  };
  return () => {
    remoteUnsub?.();
    remoteUnsub = null;
  };
}

/** Riconnette listen remote (FORZA PULL). */
export async function forceReconnectRemote(onEvent: (e: SyncEvent) => void) {
  try {
    remoteUnsub?.();
  } catch {}
  remoteUnsub = null;
  // Ping locale
  publishLocal({ kind: "sync_ping", deviceId, ts: Date.now() });
  const unsub = await listenRemote(onEvent);
  remoteUnsub = unsub;
  markCloudOk();
  return unsub;
}

export type PresencePeer = {
  deviceId: string;
  nome: string;
  ruolo: string;
  ts: number;
};

const peers: Record<string, PresencePeer> = {};
let presenceTimer: ReturnType<typeof setInterval> | null = null;
let presenceListeners: Array<() => void> = [];

function notifyPresence() {
  for (const fn of presenceListeners) {
    try {
      fn();
    } catch {}
  }
}

export function getActivePeers(maxAgeMs = 45000): PresencePeer[] {
  const now = Date.now();
  const out: PresencePeer[] = [];
  const keys = Object.keys(peers);
  for (let i = 0; i < keys.length; i++) {
    const p = peers[keys[i]];
    if (now - p.ts <= maxAgeMs) out.push(p);
    else delete peers[keys[i]];
  }
  out.sort((a, b) => a.nome.localeCompare(b.nome, "it"));
  return out;
}

export function onPresenceChange(fn: () => void) {
  presenceListeners.push(fn);
  return () => {
    presenceListeners = presenceListeners.filter((x) => x !== fn);
  };
}

export function handlePresenceEvent(e: SyncEvent) {
  if (e.kind !== "presence") return;
  if (e.deviceId === deviceId) return;
  peers[e.deviceId] = { deviceId: e.deviceId, nome: e.nome || "Device", ruolo: e.ruolo || "", ts: e.ts || Date.now() };
  notifyPresence();
}

export function startPresenceHeartbeat(getMeta: () => { nome: string; ruolo: string }) {
  if (typeof window === "undefined") return () => {};
  const beat = () => {
    const meta = getMeta();
    const ev: SyncEvent = {
      kind: "presence",
      deviceId,
      nome: meta.nome || getDeviceNick(),
      ruolo: meta.ruolo || "",
      ts: Date.now(),
    };
    publishLocal(ev);
    if (supabaseConfigured() && navigator.onLine) void publishRemote(ev);
    notifyPresence();
  };
  beat();
  if (presenceTimer) clearInterval(presenceTimer);
  presenceTimer = setInterval(beat, 20000);
  const prune = setInterval(() => notifyPresence(), 5000);
  return () => {
    if (presenceTimer) clearInterval(presenceTimer);
    presenceTimer = null;
    clearInterval(prune);
  };
}

export function broadcastChannelAvailable() {
  return Boolean(local);
}
