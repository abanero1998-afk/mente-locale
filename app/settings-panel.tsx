"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { getLocale, updateLocaleSettings } from "@/lib/tenants";
import { useCassa } from "@/lib/cassa";
import { FiscalSettingsPanel } from "./fiscal-settings";

export function SettingsPanel() {
  const sessione = useAuth((s) => s.sessione);
  const [nome, setNome] = useState("");
  const [brand, setBrand] = useState("");
  const [fondo, setFondo] = useState("150");
  const [wa, setWa] = useState("");
  const [saved, setSaved] = useState("");

  useEffect(() => {
    if (!sessione) return;
    const loc = getLocale(sessione.localeId);
    if (!loc) return;
    setNome(loc.nome);
    setBrand(loc.settings.nomeBrand || loc.nome);
    setFondo(String(loc.settings.fondoIniziale ?? 150));
    setWa(loc.settings.waSocio || "");
  }, [sessione?.localeId]);

  if (!sessione || sessione.ruolo !== "titolare") return null;

  const salva = () => {
    const next = updateLocaleSettings(sessione.localeId, {
      nome: nome.trim() || sessione.localeNome,
      nomeBrand: brand.trim() || nome.trim(),
      fondoIniziale: Number(fondo) || 0,
      waSocio: wa.trim(),
    });
    if (!next) return;
    const brandName = next.settings.nomeBrand || next.nome;
    useAuth.setState({
      sessione: { ...sessione, localeNome: brandName },
    });
    const st = useCassa.getState();
    if (st.scontrini.length === 0 && st.chiusure.length === 0) {
      st.setFondo(Number(next.settings.fondoIniziale) || 0);
    }
    setSaved("Salvato");
    setTimeout(() => setSaved(""), 2000);
  };

  return (
    <div className="rounded-[24px] glass-strong p-4 space-y-3">
      <p className="text-[10px] tracking-widest text-white/45 font-black">IMPOSTAZIONI LOCALE</p>
      <p className="text-[10px] text-white/35">ID: {sessione.localeId} · dati isolati (persist ml:{sessione.localeId}:…)</p>
      <div>
        <label className="text-[9px] text-white/40">Nome locale</label>
        <input value={nome} onChange={(e) => setNome(e.target.value)} className="w-full mt-1 p-3 rounded-xl bg-black/40 text-sm" />
      </div>
      <div>
        <label className="text-[9px] text-white/40">Brand in header</label>
        <input value={brand} onChange={(e) => setBrand(e.target.value)} className="w-full mt-1 p-3 rounded-xl bg-black/40 text-sm" />
      </div>
      <div>
        <label className="text-[9px] text-white/40">Fondo cassa iniziale €</label>
        <input type="number" value={fondo} onChange={(e) => setFondo(e.target.value)} className="w-full mt-1 p-3 rounded-xl bg-black/40 text-sm" />
      </div>
      <div>
        <label className="text-[9px] text-white/40">WhatsApp socio (es. +39…)</label>
        <input value={wa} onChange={(e) => setWa(e.target.value)} className="w-full mt-1 p-3 rounded-xl bg-black/40 text-sm" placeholder="Opzionale" />
      </div>
      <button onClick={salva} className="w-full py-3 rounded-full bg-white text-black font-black text-sm">
        SALVA IMPOSTAZIONI
      </button>
      {saved && <p className="text-[11px] text-emerald-300 text-center">{saved}</p>}
      <div className="flex gap-2">
        <button
          onClick={() => useAuth.getState().cambiaLocale()}
          className="flex-1 py-2 rounded-full glass text-[10px] font-black"
        >
          CAMBIA LOCALE
        </button>
        <button
          onClick={() => {
            useAuth.getState().cambiaLocale();
          }}
          className="flex-1 py-2 rounded-full glass text-[10px] font-black"
        >
          NUOVO LOCALE
        </button>
      </div>
      <div className="pt-2">
        <FiscalSettingsPanel />
      </div>
    </div>
  );
}
