"use client";

export type UiSoundKind = "tap" | "success" | "nav" | "error";

let sharedCtx: AudioContext | null = null;

function muted(): boolean {
  if (typeof sessionStorage === "undefined") return false;
  try {
    return sessionStorage.getItem("ml-mute-sounds") === "1";
  } catch {
    return false;
  }
}

function ctx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  try {
    if (!sharedCtx) {
      const AC =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AC) return null;
      sharedCtx = new AC();
    }
    if (sharedCtx.state === "suspended") void sharedCtx.resume();
    return sharedCtx;
  } catch {
    return null;
  }
}

function beep(opts: {
  freq: number;
  dur: number;
  vol: number;
  type?: OscillatorType;
  delay?: number;
  slideTo?: number;
}) {
  const c = ctx();
  if (!c) return;
  const t0 = c.currentTime + (opts.delay || 0);
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = opts.type || "sine";
  osc.frequency.setValueAtTime(opts.freq, t0);
  if (opts.slideTo != null) {
    osc.frequency.linearRampToValueAtTime(opts.slideTo, t0 + opts.dur);
  }
  const peak = Math.max(0.001, opts.vol);
  gain.gain.setValueAtTime(0.0001, t0);
  gain.gain.exponentialRampToValueAtTime(peak, t0 + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + opts.dur);
  osc.connect(gain);
  gain.connect(c.destination);
  osc.start(t0);
  osc.stop(t0 + opts.dur + 0.02);
}

/** Soft short UI clicks (WebAudio). Volume ~0.04–0.08. */
export function playUi(kind: UiSoundKind) {
  if (muted()) return;
  try {
    if (kind === "tap") {
      beep({ freq: 620, dur: 0.045, vol: 0.045, type: "sine" });
    } else if (kind === "nav") {
      beep({ freq: 480, dur: 0.055, vol: 0.05, type: "triangle", slideTo: 720 });
    } else if (kind === "success") {
      beep({ freq: 660, dur: 0.07, vol: 0.055, type: "sine" });
      beep({ freq: 880, dur: 0.09, vol: 0.05, type: "sine", delay: 0.055 });
    } else if (kind === "error") {
      beep({ freq: 220, dur: 0.12, vol: 0.06, type: "triangle", slideTo: 160 });
    }
  } catch {}
}

/** Louder distinct KDS alert for cucina vs bar (~0.15–0.25). */
export function playKdsAlert(reparto: "cucina" | "bar") {
  if (muted()) return;
  try {
    if (reparto === "cucina") {
      // two mid pulses
      beep({ freq: 440, dur: 0.14, vol: 0.2, type: "square" });
      beep({ freq: 520, dur: 0.16, vol: 0.18, type: "square", delay: 0.18 });
    } else {
      // bar: higher triple chirp
      beep({ freq: 780, dur: 0.08, vol: 0.18, type: "sine" });
      beep({ freq: 920, dur: 0.08, vol: 0.2, type: "sine", delay: 0.1 });
      beep({ freq: 1100, dur: 0.1, vol: 0.16, type: "sine", delay: 0.2 });
    }
  } catch {}
}

/** Route IA Socio alarm/ding through soft WebAudio (keeps old wav attempt optional). */
export function playIaAlarm(urgente: boolean) {
  if (muted()) return;
  try {
    if (urgente) {
      beep({ freq: 420, dur: 0.22, vol: 0.14, type: "triangle" });
      beep({ freq: 360, dur: 0.28, vol: 0.12, type: "triangle", delay: 0.2 });
    } else {
      beep({ freq: 880, dur: 0.12, vol: 0.1, type: "sine" });
    }
  } catch {}
}

export function withSoundTap<T extends unknown[]>(
  handler: (...args: T) => void,
  kind: UiSoundKind = "tap"
): (...args: T) => void {
  return (...args: T) => {
    playUi(kind);
    handler(...args);
  };
}

/** Hook-like helper usable as onClick={() => { useSoundTap(); ... }} */
export function useSoundTap(kind: UiSoundKind = "tap") {
  return () => playUi(kind);
}
