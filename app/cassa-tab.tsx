"use client";

import { useState } from "react";
import { useCassa, type Pagamento } from "@/lib/cassa";
import { useAuth } from "@/lib/auth";

export function CassaTab() {
  const scontrini = useCassa((s) => s.scontrini);
  const chiusure = useCassa((s) => s.chiusure);
  const fondo = useCassa((s) => s.fondo);
  const sessione = useAuth((s) => s.sessione);
  const [contato, setContato] = useState(String(fondo));
  const [last, setLast] = useState("");
  const oggi = new Date().toISOString().slice(0, 10);
  const oggiRows = scontrini.filter((x) => new Date(x.ts).toISOString().slice(0, 10) === oggi);
  const tot = oggiRows.reduce((a, x) => a + x.totale, 0);
  const by = (p: Pagamento) => oggiRows.filter((x) => x.pagamento === p).reduce((a, x) => a + x.totale, 0);

  return (
    <div className="space-y-3">
      <h2 className="font-black tracking-widest text-sm">CASSA</h2>
      <div className="grid grid-cols-2 gap-2">
        <div className="glass rounded-2xl p-3"><p className="text-[9px] text-white/40">INCASSO OGGI</p><p className="text-2xl font-black">€{tot}</p></div>
        <div className="glass rounded-2xl p-3"><p className="text-[9px] text-white/40">SCONTRINI</p><p className="text-2xl font-black">{oggiRows.length}</p></div>
        <div className="glass rounded-2xl p-3"><p className="text-[9px] text-white/40">CONTANTI</p><p className="text-xl font-black">€{by("contanti")}</p></div>
        <div className="glass rounded-2xl p-3"><p className="text-[9px] text-white/40">CARTA / SATISPAY</p><p className="text-xl font-black">€{by("carta") + by("satispay")}</p></div>
      </div>
      <div className="glass-strong rounded-2xl p-4 space-y-2">
        <p className="font-black text-sm">CHIUSURA SERATA</p>
        <p className="text-[10px] text-white/40">Fondo in cassetto €{fondo}. Inserisci contato reale.</p>
        <input type="number" value={contato} onChange={(e) => setContato(e.target.value)} className="w-full p-3 rounded-xl bg-black/30" />
        <button
          onClick={() => {
            const ch = useCassa.getState().chiudiSerata(Number(contato) || 0, sessione?.staffNome || "Sala");
            setLast(`Chiusura €${ch.totale} · diff €${ch.differenza.toFixed(2)}`);
          }}
          className="w-full py-3 rounded-full bg-[#FF1A1A] text-black font-black"
        >CHIUDI SERATA</button>
        {last && <p className="text-[10px] text-white/50">{last}</p>}
      </div>
      {oggiRows.slice(0, 12).map((s) => (
        <div key={s.id} className="glass rounded-2xl p-3 flex justify-between text-sm">
          <span>{s.tavolo} · {s.pagamento}</span>
          <span className="font-black">€{s.totale}</span>
        </div>
      ))}
      {chiusure[0] && <p className="text-[10px] text-white/30">Ultima chiusura {chiusure[0].data} · €{chiusure[0].totale}</p>}
    </div>
  );
}
