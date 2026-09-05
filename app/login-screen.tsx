"use client";

import { useState } from "react";
import { useAuth } from "@/lib/auth";

export function LoginScreen() {
  const [locale, setLocale] = useState("mentelocale");
  const [pin, setPin] = useState("");
  const errore = useAuth((s) => s.errore);
  return (
    <div className="min-h-screen bg-[#050507] text-white flex items-center justify-center p-6">
      <div className="w-full max-w-sm space-y-3">
        <img src="/logo-mark.jpg" alt="ML" className="w-16 h-16 rounded-2xl mx-auto object-cover" />
        <h1 className="text-center font-black tracking-[0.25em]">ACCESSO LOCALE</h1>
        <p className="text-center text-[10px] text-white/40">Solo il tuo ristorante. Nessun elenco sedi.</p>
        <input value={locale} onChange={(e) => setLocale(e.target.value)} placeholder="Codice locale" className="w-full p-4 rounded-2xl bg-white/5 border border-white/10" />
        <input value={pin} onChange={(e) => setPin(e.target.value)} placeholder="PIN staff" type="password" inputMode="numeric" className="w-full p-4 rounded-2xl bg-white/5 border border-white/10" />
        {errore && <p className="text-xs text-[#FF6B6B]">{errore}</p>}
        <button onClick={() => useAuth.getState().login(locale, pin)} className="w-full py-4 rounded-full bg-[#FF1A1A] text-black font-black">ENTRA</button>
        <p className="text-[10px] text-white/30 text-center">PIN demo: 0000 cameriere · 1111 cucina · 2222 bar · 9999 titolare</p>
      </div>
    </div>
  );
}
