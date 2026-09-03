"use client";

import { useRef, useState } from "react";
import { useMenteStore } from "@/lib/store";
import type { Piatto } from "@/lib/types";

export function ProdottoRow({ p, onDelete }: { p: Piatto; onDelete: (id: string) => void }) {
  const [showDelete, setShowDelete] = useState(false);
  const startX = useRef(0);
  return (
    <div
      className="relative overflow-hidden rounded-2xl glass"
      onTouchStart={(e) => { startX.current = e.touches[0].clientX; }}
      onTouchEnd={(e) => {
        const dx = e.changedTouches[0].clientX - startX.current;
        if (dx < -48) setShowDelete(true);
        if (dx > 48) setShowDelete(false);
      }}
      onMouseDown={(e) => { startX.current = e.clientX; }}
      onMouseUp={(e) => {
        const dx = e.clientX - startX.current;
        if (dx < -48) setShowDelete(true);
        if (dx > 48) setShowDelete(false);
      }}
    >
      <div className="flex justify-between items-center p-4">
        <span>{p.img} {p.nome} • €{p.prezzo}</span>
        <span className="text-[10px] text-white/40 tracking-widest">{p.categoria} • {p.reparto.toUpperCase()}</span>
      </div>
      {showDelete && (
        <div className="absolute inset-0 bg-[#FF1A1A] flex justify-end items-center pr-6">
          <button onClick={() => onDelete(p.id)} className="text-black font-black">ELIMINA ✕</button>
        </div>
      )}
    </div>
  );
}

export function MenuTab({ onAdd }: { onAdd: () => void }) {
  const menu = useMenteStore((s) => s.menu);
  return (
    <div className="space-y-3">
      <div className="flex justify-between items-end">
        <div>
          <h2 className="font-black tracking-widest text-sm">MENU</h2>
          <p className="text-[10px] text-white/40">Swipe SX elimina • sync su tutti i telefoni</p>
        </div>
        <span className="text-[10px] text-white/30">{menu.length} piatti</span>
      </div>
      {menu.map((p) => (
        <ProdottoRow key={p.id} p={p} onDelete={(id) => void useMenteStore.getState().eliminaProdotto(id)} />
      ))}
      <button onClick={onAdd} className="w-full py-4 rounded-full bg-white text-black font-black">+ AGGIUNGI PRODOTTO</button>
    </div>
  );
}
