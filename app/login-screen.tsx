"use client";

import { useMemo, useState } from "react";
import { listLocali, useAuth } from "@/lib/auth";
import { DEMO_STAFF_PINS } from "@/lib/tenants";

type Tab = "entra" | "crea";

export function LoginScreen() {
  const [tab, setTab] = useState<Tab>("entra");
  const [nome, setNome] = useState("");
  const [pinTit, setPinTit] = useState("");
  const [localeId, setLocaleId] = useState("");
  const [pin, setPin] = useState("");
  const errore = useAuth((s) => s.errore);
  const lastPins = useAuth((s) => s.lastCreatedPins);
  const locali = useMemo(() => listLocali(), [tab, lastPins]);

  return (
    <div className="min-h-screen bg-[#050507] text-white flex items-center justify-center p-6">
      <style>{`.glass{backdrop-filter:blur(40px);background:rgba(255,255,255,.03);border:.5px solid rgba(255,26,26,.08)}`}</style>
      <div className="w-full max-w-sm space-y-3">
        <img src="/logo-mark.jpg" alt="ML" className="w-16 h-16 rounded-2xl mx-auto object-cover" />
        <h1 className="text-center font-black tracking-[0.25em]">MENTE LOCALE</h1>
        <p className="text-center text-[10px] text-white/40">Ogni locale ha menu, cassa e HACCP isolati</p>

        <div className="flex gap-2 p-1 rounded-full glass">
          <button
            onClick={() => setTab("entra")}
            className={`flex-1 py-2 rounded-full text-[11px] font-black ${tab === "entra" ? "bg-[#FF1A1A] text-black" : "text-white/50"}`}
          >
            ENTRA
          </button>
          <button
            onClick={() => setTab("crea")}
            className={`flex-1 py-2 rounded-full text-[11px] font-black ${tab === "crea" ? "bg-[#FF1A1A] text-black" : "text-white/50"}`}
          >
            CREA LOCALE
          </button>
        </div>

        {tab === "crea" ? (
          <>
            <input
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Nome locale (es. Osteria Roma)"
              className="w-full p-4 rounded-2xl bg-white/5 border border-white/10"
            />
            <input
              value={pinTit}
              onChange={(e) => setPinTit(e.target.value)}
              placeholder="PIN titolare (4–8 cifre)"
              type="password"
              inputMode="numeric"
              className="w-full p-4 rounded-2xl bg-white/5 border border-white/10"
            />
            {errore && <p className="text-xs text-[#FF6B6B]">{errore}</p>}
            <button
              onClick={() => useAuth.getState().createLocale(nome, pinTit)}
              className="w-full py-4 rounded-full bg-[#FF1A1A] text-black font-black"
            >
              CREA E ACCEDI
            </button>
            <p className="text-[10px] text-white/30 text-center">
              Verranno creati anche PIN demo staff solo per questo locale:
              <br />
              0000 cameriere · 1111 cucina · 2222 bar
            </p>
          </>
        ) : (
          <>
            {locali.length > 0 && (
              <div className="space-y-1.5 max-h-40 overflow-y-auto">
                <p className="text-[9px] tracking-widest text-white/40 font-black">I TUOI LOCALI</p>
                {locali.map((l) => (
                  <button
                    key={l.id}
                    onClick={() => setLocaleId(l.id)}
                    className={`w-full text-left px-4 py-3 rounded-2xl glass text-sm ${
                      localeId === l.id ? "ring-1 ring-[#FF1A1A]" : ""
                    }`}
                  >
                    <span className="font-black">{l.nome}</span>
                    <span className="block text-[10px] text-white/35">{l.id}</span>
                  </button>
                ))}
              </div>
            )}
            <input
              value={localeId}
              onChange={(e) => setLocaleId(e.target.value)}
              placeholder="ID locale (o seleziona sopra)"
              className="w-full p-4 rounded-2xl bg-white/5 border border-white/10"
            />
            <input
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              placeholder="PIN staff di questo locale"
              type="password"
              inputMode="numeric"
              className="w-full p-4 rounded-2xl bg-white/5 border border-white/10"
            />
            {errore && <p className="text-xs text-[#FF6B6B]">{errore}</p>}
            <button
              onClick={() => useAuth.getState().login(localeId, pin)}
              className="w-full py-4 rounded-full bg-[#FF1A1A] text-black font-black"
            >
              ENTRA
            </button>
            <p className="text-[10px] text-white/30 text-center">
              PIN validi solo per il locale scelto (titolare + demo {DEMO_STAFF_PINS.map((d) => d.pin).join(" / ")})
            </p>
          </>
        )}

        {lastPins && lastPins.length > 0 && (
          <div className="rounded-2xl glass p-3 space-y-1">
            <p className="text-[10px] font-black text-emerald-300">PIN creati (salva ora)</p>
            {lastPins.map((r) => (
              <p key={r.ruolo + r.pin} className="text-[11px] text-white/70">
                {r.nome}: <span className="font-black text-white">{r.pin}</span>
              </p>
            ))}
            <button
              onClick={() => useAuth.getState().clearCreatedPins()}
              className="text-[9px] text-white/40 mt-1"
            >
              Nascondi
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
