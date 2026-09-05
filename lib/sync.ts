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
};
type ClientLike = {
  from: (table: string) => { insert: (row: Record<string, unknown>) => Promise<{ error: Error | null }> };
  channel: (name: string) => ChannelLike;
};

let sb: ClientLike | null = null;
let sbPromise: Promise<ClientLike | null> | null = null;

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

const local = typeof window !== "undefined" && "BroadcastChannel" in window ? new BroadcastChannel(channelName()) : null;

export function publishLocal(event: SyncEvent) {
  try {
    local?.postMessage(event);
  } catch {}
}

export function listenLocal(onEvent: (e: SyncEvent) => void) {
  if (!local) return () => {};
  const handler = (ev: MessageEvent<SyncEvent>) => {
    if (ev.data?.deviceId && ev.data.deviceId !== deviceId) onEvent(ev.data);
  };
  local.addEventListener("message", handler);
  return () => local.removeEventListener("message", handler);
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
    if (ev?.deviceId && ev.deviceId !== deviceId) onEvent(ev);
  });
  ch.subscribe();
  return () => {};
}
