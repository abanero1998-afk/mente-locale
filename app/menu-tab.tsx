"use client";

import { useMemo, useRef, useState } from "react";
import { useMenteStore } from "@/lib/store";
import { SEZIONI_MENU, type Piatto, type Reparto } from "@/lib/types";

const PLACEHOLDER_IMG =
  "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400&h=300&fit=crop";

function isImgUrl(v: string) {
  return typeof v === "string" && (v.startsWith("http://") || v.startsWith("https://") || v.startsWith("/"));
}

export function ProductThumb({ src, alt, size = 48 }: { src: string; alt: string; size?: number }) {
  const url = isImgUrl(src) ? src : PLACEHOLDER_IMG;
  return (
    <img
      src={url}
      alt={alt}
      width={size}
      height={size}
      className="rounded-xl object-cover shrink-0 bg-white/5"
      style={{ width: size, height: size }}
      loading="lazy"
      onError={(e) => {
        const el = e.currentTarget;
        if (el.src !== PLACEHOLDER_IMG) el.src = PLACEHOLDER_IMG;
      }}
    />
  );
}

export function ProdottoRow({ p, onDelete }: { p: Piatto; onDelete: (id: string) => void }) {
  const [showDelete, setShowDelete] = useState(false);
  const startX = useRef(0);
  return (
    <div
      className="relative overflow-hidden rounded-2xl glass"
      onTouchStart={(e) => {
        startX.current = e.touches[0].clientX;
      }}
      onTouchEnd={(e) => {
        const dx = e.changedTouches[0].clientX - startX.current;
        if (dx < -48) setShowDelete(true);
        if (dx > 48) setShowDelete(false);
      }}
      onMouseDown={(e) => {
        startX.current = e.clientX;
      }}
      onMouseUp={(e) => {
        const dx = e.clientX - startX.current;
        if (dx < -48) setShowDelete(true);
        if (dx > 48) setShowDelete(false);
      }}
    >
      <div className="flex justify-between items-center p-3 gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <ProductThumb src={p.img} alt={p.nome} size={52} />
          <div className="min-w-0">
            <p className="font-bold truncate">{p.nome}</p>
            <p className="text-[11px] text-white/50">EUR {p.prezzo.toFixed(2)}</p>
          </div>
        </div>
        <span className="text-[10px] text-white/40 tracking-widest shrink-0">
          {p.categoria} - {p.reparto.toUpperCase()}
        </span>
      </div>
      {showDelete && (
        <div className="absolute inset-0 bg-[#FF1A1A] flex justify-end items-center pr-6">
          <button onClick={() => onDelete(p.id)} className="text-black font-black">
            ELIMINA
          </button>
        </div>
      )}
    </div>
  );
}

type FormState = {
  nome: string;
  prezzo: string;
  categoria: string;
  reparto: Reparto;
  img: string;
};

const EMPTY_FORM: FormState = {
  nome: "",
  prezzo: "",
  categoria: "Primi",
  reparto: "cucina",
  img: "",
};

export function MenuTab({ onAdd }: { onAdd?: () => void }) {
  const menu = useMenteStore((s) => s.menu);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const bySection = useMemo(() => {
    const sections: Record<string, Piatto[]> = {};
    for (const s of SEZIONI_MENU) sections[s] = [];
    const altri: Piatto[] = [];
    for (const p of menu) {
      if (Object.prototype.hasOwnProperty.call(sections, p.categoria)) sections[p.categoria].push(p);
      else altri.push(p);
    }
    return { sections, altri };
  }, [menu]);

  const openAdd = () => {
    setForm(EMPTY_FORM);
    setShowForm(true);
    onAdd?.();
  };

  const salva = async () => {
    if (!form.nome.trim()) return;
    setSaving(true);
    try {
      await useMenteStore.getState().aggiungiProdotto({
        nome: form.nome,
        prezzo: form.prezzo,
        categoria: form.categoria,
        reparto: form.reparto,
        img: form.img.trim() || PLACEHOLDER_IMG,
      });
      setShowForm(false);
      setForm(EMPTY_FORM);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-end">
        <div>
          <h2 className="font-black tracking-widest text-sm">MENU</h2>
          <p className="text-[10px] text-white/40">Sezioni - swipe SX elimina - sync live</p>
        </div>
        <span className="text-[10px] text-white/30">{menu.length} piatti</span>
      </div>

      {SEZIONI_MENU.map((sez) => {
        const items = bySection.sections[sez] || [];
        if (!items.length) return null;
        return (
          <section key={sez} className="space-y-2">
            <h3 className="text-[11px] font-black tracking-[0.18em] text-[#FF2A2A]">
              {sez.toUpperCase()}
            </h3>
            {items.map((p) => (
              <ProdottoRow
                key={p.id}
                p={p}
                onDelete={(id) => {
                  void useMenteStore.getState().eliminaProdotto(id);
                }}
              />
            ))}
          </section>
        );
      })}

      {bySection.altri.length > 0 && (
        <section className="space-y-2">
          <h3 className="text-[11px] font-black tracking-[0.18em] text-white/50">ALTRO</h3>
          {bySection.altri.map((p) => (
            <ProdottoRow
              key={p.id}
              p={p}
              onDelete={(id) => {
                void useMenteStore.getState().eliminaProdotto(id);
              }}
            />
          ))}
        </section>
      )}

      <button onClick={openAdd} className="w-full py-4 rounded-full bg-white text-black font-black">
        + AGGIUNGI PRODOTTO
      </button>

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-end bg-black/70 p-3">
          <div className="w-full max-w-[560px] mx-auto rounded-[28px] glass-strong p-5 space-y-3">
            <div className="flex justify-between items-center">
              <h3 className="font-black tracking-wide">NUOVO PRODOTTO</h3>
              <button onClick={() => setShowForm(false)} className="text-white/50">
                X
              </button>
            </div>
            <label className="block space-y-1">
              <span className="text-[10px] text-white/40 tracking-widest">NOME</span>
              <input
                value={form.nome}
                onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))}
                className="w-full rounded-2xl glass px-4 py-3 bg-transparent outline-none"
                placeholder="Es. Carbonara"
              />
            </label>
            <label className="block space-y-1">
              <span className="text-[10px] text-white/40 tracking-widest">PREZZO EUR</span>
              <input
                value={form.prezzo}
                onChange={(e) => setForm((f) => ({ ...f, prezzo: e.target.value }))}
                inputMode="decimal"
                className="w-full rounded-2xl glass px-4 py-3 bg-transparent outline-none"
                placeholder="16"
              />
            </label>
            <label className="block space-y-1">
              <span className="text-[10px] text-white/40 tracking-widest">SEZIONE</span>
              <select
                value={form.categoria}
                onChange={(e) => setForm((f) => ({ ...f, categoria: e.target.value }))}
                className="w-full rounded-2xl glass px-4 py-3 bg-[#0a0a0c] outline-none"
              >
                {SEZIONI_MENU.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </label>
            <label className="block space-y-1">
              <span className="text-[10px] text-white/40 tracking-widest">REPARTO</span>
              <select
                value={form.reparto}
                onChange={(e) => setForm((f) => ({ ...f, reparto: e.target.value as Reparto }))}
                className="w-full rounded-2xl glass px-4 py-3 bg-[#0a0a0c] outline-none"
              >
                <option value="cucina">Cucina</option>
                <option value="bar">Bar</option>
              </select>
            </label>
            <label className="block space-y-1">
              <span className="text-[10px] text-white/40 tracking-widest">URL IMMAGINE</span>
              <input
                value={form.img}
                onChange={(e) => setForm((f) => ({ ...f, img: e.target.value }))}
                className="w-full rounded-2xl glass px-4 py-3 bg-transparent outline-none text-[12px]"
                placeholder="https://images.unsplash.com/..."
              />
            </label>
            {form.img.trim() && isImgUrl(form.img.trim()) && (
              <div className="flex items-center gap-3 pt-1">
                <ProductThumb src={form.img.trim()} alt="Anteprima" size={64} />
                <span className="text-[10px] text-white/40">Anteprima</span>
              </div>
            )}
            <button
              onClick={() => {
                void salva();
              }}
              disabled={saving || !form.nome.trim()}
              className="w-full py-4 rounded-full bg-[#FF1A1A] text-black font-black disabled:opacity-40"
            >
              {saving ? "SALVO..." : "SALVA PRODOTTO"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
