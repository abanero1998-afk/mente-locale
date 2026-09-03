import type { SyncEvent } from "./types";

const CHANNEL = "mente-locale-kds";

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
  on: (
    type: string,
    filter: unknown,
    cb: (payload: { payload: SyncEvent }) => void
  ) => ChannelLike;
  send: (msg: { type: string; event: string; payload: SyncEvent }) => Promise<string>;
  subscribe: () => string | void;
};

type ClientLike = {
  from: (table: string) => {
    insert: (row: Record<string, unknown>) => Promise<{ error: Error | null }>;
  };
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

const local = typeof window !== "undefined" && "BroadcastChannel" in window ? new BroadcastChannel(CHANNEL) : null;

export function publishLocal(event: SyncEvent) {
  try {
    local?.postMessage(event);
  } catch {
    /* ignore */
  }
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
  try {
    if (event.kind === "nuovo_ordine") {
      await client.from("ordini").insert({
        id: event.ordine.id,
        tavolo_id: event.tavoloId,
        piatto: event.ordine.piatto,
        qta: event.ordine.qta,
        stato: event.ordine.stato,
        ora: event.ordine.ora,
      });
    }
    await client.channel("kds").send({ type: "broadcast", event: "sync", payload: event });
    return true;
  } catch {
    return false;
  }
}

export async function listenRemote(onEvent: (e: SyncEvent) => void) {
  const client = await getSupabase();
  if (!client) return () => {};
  const ch = client.channel("kds");
  ch.on("broadcast", { event: "sync" }, (payload) => {
    const ev = payload.payload;
    if (ev?.deviceId && ev.deviceId !== deviceId) onEvent(ev);
  });
  ch.subscribe();
  return () => {};
}
