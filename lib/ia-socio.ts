"use client";

import { useMenteStore } from "./store";
import { deviceId, publishLocal, publishRemote, supabaseConfigured } from "./sync";

const WA_TO = process.env.NEXT_PUBLIC_SOCIO_WA || "+3444106229";
const SLOT_HOURS = [17, 19, 21, 23];

function playIaSound(urgente: boolean) {
  const audio = new Audio(urgente ? "/sounds/alarm.wav" : "/sounds/ding-pronto.wav");
  audio.volume = 0.6;
  audio.play().catch(() => {
    try {
      const ctx = new AudioContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.frequency.value = urgente ? 420 : 880;
      gain.gain.value = 0.09;
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + (urgente ? 0.35 : 0.18));
    } catch {}
  });
}

async function notifyPush(msg: string) {
  try {
    if (!("Notification" in window)) return;
    if (Notification.permission !== "granted") return;
    const reg = await navigator.serviceWorker?.ready;
    if (reg?.active) {
      reg.active.postMessage({ type: "NOTIFY", title: "IA Socio", body: msg, tag: "ia-socio", url: "/?tab=haccp" });
    } else {
      new Notification("IA Socio", { body: msg, icon: "/logo-mark.jpg", tag: "ia-socio" });
    }
  } catch {}
}

export async function avvisaSocio(msg: string) {
  const urgente = msg.includes("🚨") || msg.includes("TEMP FRIGO");
  useMenteStore.getState().pushAvviso(msg, urgente);
  playIaSound(urgente);
  void notifyPush(msg);
  const ev = { kind: "avviso_socio" as const, msg, urgente, deviceId };
  publishLocal(ev);
  if (supabaseConfigured()) await publishRemote(ev);
  if (urgente) {
    try {
      await fetch("/api/whatsapp/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to: WA_TO, msg }),
      });
    } catch {}
  }
}

export async function runIaCheck() {
  const { tavoli, magazzino, frighi } = useMenteStore.getState();
  const critici = magazzino.filter((m) => m.qta < m.soglia || m.qta < 5);
  const fuori = frighi.filter((f) => f.temp > f.max || f.temp < f.min);
  const lenti = tavoli.filter((t) => t.stato !== "libero" && t.tempo > 60);
  if (critici.length) await avvisaSocio(`⚠️ Sergio, stanno finendo: ${critici.map((m) => m.nome).join(", ")}. Ordino da Rossi?`);
  if (fuori.length) await avvisaSocio(`🚨 Frigo ${fuori[0].nome} a ${fuori[0].temp}°C! Chiama tecnico!`);
  if (lenti.length) await avvisaSocio(`⏱️ ${lenti[0].nome} occupato da ${lenti[0].tempo}min, sollecita?`);
  if (!critici.length && !fuori.length && !lenti.length) {
    await avvisaSocio("✅ Tutto ok: magazzino, frighi e tempi tavolo sotto controllo.");
  }
}

export async function checkFrigoSlot() {
  const now = new Date();
  const hour = now.getHours();
  const minute = now.getMinutes();
  if (!SLOT_HOURS.includes(hour) || minute > 8) return;
  const key = `${now.toDateString()}-${hour}`;
  if (typeof sessionStorage !== "undefined" && sessionStorage.getItem(`frigo-slot-${key}`)) return;
  sessionStorage.setItem(`frigo-slot-${key}`, "1");
  const { frighi } = useMenteStore.getState();
  const stale = frighi.filter((f) => !f.lastCheck || Date.now() - f.lastCheck > 110 * 60 * 1000);
  if (stale.length) {
    await avvisaSocio(`TEMP FRIGO ${hour}:00 — aggiorna temperature (${stale.map((f) => f.nome).join(", ")}). Apri HACCP e clicca AGGIORNATO.`);
  } else {
    await avvisaSocio(`TEMP FRIGO ${hour}:00 — slot di controllo. Conferma le temperature in HACCP.`);
  }
}

let loopOn = false;
export function startIaLoop() {
  if (loopOn || typeof window === "undefined") return;
  loopOn = true;
  setTimeout(() => void runIaCheck(), 2500);
  setTimeout(() => void checkFrigoSlot(), 4000);
  setInterval(() => void runIaCheck(), 300000);
  setInterval(() => void checkFrigoSlot(), 60000);
}
