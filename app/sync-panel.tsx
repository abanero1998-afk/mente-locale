"use client";

import { useEffect, useState } from "react";
import { useMenteStore } from "@/lib/store";
import {
  broadcastChannelAvailable,
  deviceId,
  deviceIdShort,
  forceReconnectRemote,
  getActivePeers,
  getDeviceNick,
  getLastCloudOk,
  getLastLocalMsg,
  onPresenceChange,
  setDeviceNick,
  supabaseConfigured,
  type PresencePeer,
} from "@/lib/sync";

export function SyncPanel({ compact }: { compact?: boolean }) {
  const online = useMenteStore((s) => s.online);
  const coda = useMenteStore((s) => s.codaOffline);
  const [open, setOpen] = useState(false);
  const [nick, setNick] = useState("Questo device");
  const [peers, setPeers] = useState<PresencePeer[]>([]);
  const [msg, setMsg] = useState("");
  const [tick, setTick] = useState(0);

  useEffect(() => {
    setNick(getDeviceNick());
    const unsub = onPresenceChange(() => setPeers(getActivePeers()));
    setPeers(getActivePeers());
    const t = setInterval(() => setTick((x) => x + 1), 5000);
    return () => {
      unsub();
      clearInterval(t);
    };
  }, []);

  const localOk = broadcastChannelAvailable() && (getLastLocalMsg() > 0 || true);
  const cloudCfg = supabaseConfigured();
  const cloudFresh = cloudCfg && Date.now() - getLastCloudOk() < 120000;
  void tick;

  const retry = async () => {
    setMsg("Sincronizzazione in corso…");
    await useMenteStore.getState().syncCoda();
    setMsg(useMenteStore.getState().codaOffline.length ? "Alcuni eventi ancora in coda" : "Coda svuotata");
  };

  const forzaPull = async () => {
    setMsg("Riconnessione…");
    await forceReconnectRemote((e) => useMenteStore.getState().applicaEvento(e));
    await useMenteStore.getState().syncCoda();
    setMsg("Pull forzato completato");
  };

  const badge = !online ? (
    <span className="px-2 py-0.5 rounded-full text-[9px] font-black bg-amber-400/90 text-black">OFFLINE{coda.length ? ` · ${coda.length}` : ""}</span>
  ) : coda.length > 0 ? (
    <span className="px-2 py-0.5 rounded-full text-[9px] font-black bg-amber-400/80 text-black">CODA {coda.length}</span>
  ) : (
    <span className="px-2 py-0.5 rounded-full text-[9px] font-black bg-emerald-400/80 text-black">SYNC</span>
  );

  return (
    <div className="relative">
      <button onClick={() => setOpen((v) => !v)} className="flex items-center gap-1.5" title="Stato sync">
        {badge}
      </button>
      {open && (
        <div className={`absolute right-0 mt-2 z-50 w-[min(92vw,340px)] rounded-2xl glass-strong p-4 space-y-3 shadow-2xl ${compact ? "" : ""}`}>
          <div className="flex justify-between items-start gap-2">
            <div>
              <p className="font-black text-xs tracking-widest">SYNC MULTI-DEVICE</p>
              <p className="text-[10px] text-white/40 mt-1">Stesso Wi‑Fi / stesso localeId = sala+cucina+bar allineati</p>
            </div>
            <button onClick={() => setOpen(false)} className="text-white/40 text-sm">✕</button>
          </div>

          <div className="flex flex-wrap gap-1.5">
            <span className={`px-2 py-1 rounded-full text-[9px] font-black ${online ? "bg-emerald-400 text-black" : "bg-amber-400 text-black"}`}>
              {online ? "ONLINE" : "OFFLINE"}
            </span>
            <span className={`px-2 py-1 rounded-full text-[9px] font-black ${localOk ? "bg-sky-400 text-black" : "bg-white/20"}`}>
              SYNC LOCALE
            </span>
            <span className={`px-2 py-1 rounded-full text-[9px] font-black ${cloudFresh ? "bg-violet-400 text-black" : cloudCfg ? "bg-white/25" : "bg-white/10 text-white/50"}`}>
              CLOUD {cloudCfg ? (cloudFresh ? "OK" : "ready") : "off"}
            </span>
          </div>

          <div>
            <label className="text-[9px] text-white/40">Nickname device</label>
            <div className="flex gap-2 mt-1">
              <input
                value={nick}
                onChange={(e) => setNick(e.target.value)}
                onBlur={() => setDeviceNick(nick)}
                className="flex-1 rounded-xl bg-black/40 border border-white/10 px-3 py-2 text-xs outline-none"
                placeholder="Es. iPad Sala"
              />
              <button
                onClick={() => {
                  setDeviceNick(nick);
                  setMsg("Nickname salvato");
                }}
                className="px-3 rounded-xl bg-white text-black text-[10px] font-black"
              >
                OK
              </button>
            </div>
            <p className="text-[9px] text-white/30 mt-1">ID · {deviceIdShort()} ({String(deviceId).slice(0, 12)}…)</p>
          </div>

          <div>
            <p className="text-[9px] text-white/40 mb-1">Dispositivi attivi</p>
            {peers.length === 0 ? (
              <p className="text-[11px] text-white/35">Nessun altro device (heartbeat ogni 20s)</p>
            ) : (
              <div className="space-y-1">
                {peers.map((p) => (
                  <div key={p.deviceId} className="flex justify-between text-[11px] glass rounded-xl px-3 py-2">
                    <span className="font-bold truncate">{p.nome}</span>
                    <span className="text-white/40">{p.ruolo || "—"}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex gap-2">
            <button onClick={() => void retry()} className="flex-1 py-2 rounded-full bg-[#FF1A1A] text-black text-[10px] font-black">
              RIPROVA SYNC{coda.length ? ` (${coda.length})` : ""}
            </button>
            <button onClick={() => void forzaPull()} className="flex-1 py-2 rounded-full glass text-[10px] font-black">
              FORZA PULL
            </button>
          </div>
          {msg && <p className="text-[10px] text-white/50">{msg}</p>}
        </div>
      )}
    </div>
  );
}

/** Amber offline badge for header when offline / queued. */
export function SyncHeaderBadge() {
  return <SyncPanel compact />;
}
