"use client";

import { useMemo, useState } from "react";
import { cassaDayKey, scontrinoAttivo, useCassa, type Pagamento, type ScontrinoCassa } from "@/lib/cassa";
import { useAuth } from "@/lib/auth";
import {
  buildChiusureCsv,
  buildVenditeCsv,
  downloadCsv,
  filterScontriniPeriodo,
  stampaReportPeriodo,
  type Periodo,
} from "@/lib/report-export";

const PAG: Pagamento[] = ["contanti", "carta", "satispay", "misto"];

function euro(n: number) {
  return `€${(Number(n) || 0).toFixed(2)}`;
}

function ReportExportBlock() {
  const scontrini = useCassa((s) => s.scontrini);
  const chiusure = useCassa((s) => s.chiusure);
  const [periodo, setPeriodo] = useState<Periodo>("oggi");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [msg, setMsg] = useState("");

  const filtered = useMemo(
    () => filterScontriniPeriodo(scontrini, periodo, from, to),
    [scontrini, periodo, from, to]
  );

  const label =
    periodo === "oggi"
      ? "Oggi"
      : periodo === "7gg"
        ? "Ultimi 7 giorni"
        : periodo === "30gg"
          ? "Ultimi 30 giorni"
          : from && to
            ? `${from} → ${to}`
            : "Periodo custom";

  const exportVendite = () => {
    if (!filtered.length) {
      setMsg("Nessuna vendita nel periodo selezionato");
      return;
    }
    downloadCsv(`vendite-${periodo}-${Date.now()}.csv`, buildVenditeCsv(filtered));
    setMsg(`Export ${filtered.length} scontrini`);
  };

  return (
    <div className="glass-strong rounded-2xl p-4 space-y-3">
      <p className="font-black text-sm tracking-widest">EXPORT / REPORT</p>
      <div className="flex flex-wrap gap-1.5">
        {([
          ["oggi", "Oggi"],
          ["7gg", "7 gg"],
          ["30gg", "30 gg"],
          ["custom", "Custom"],
        ] as [Periodo, string][]).map(([id, lab]) => (
          <button
            key={id}
            onClick={() => setPeriodo(id)}
            className={`px-3 py-1.5 rounded-full text-[10px] font-black ${periodo === id ? "bg-[#FF1A1A] text-black" : "glass"}`}
          >
            {lab}
          </button>
        ))}
      </div>
      {periodo === "custom" && (
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-[9px] text-white/40">Dal</label>
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-full mt-1 p-2 rounded-xl bg-black/30 text-xs" />
          </div>
          <div>
            <label className="text-[9px] text-white/40">Al</label>
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-full mt-1 p-2 rounded-xl bg-black/30 text-xs" />
          </div>
        </div>
      )}
      <p className="text-[10px] text-white/40">
        Periodo: {label} · {filtered.length} scontrini attivi
      </p>
      <button onClick={exportVendite} className="w-full py-3 rounded-full bg-white text-black font-black text-sm">
        CSV VENDITE PERIODO
      </button>
      <button
        onClick={() => {
          if (!chiusure.length) {
            setMsg("Nessuna chiusura registrata");
            return;
          }
          downloadCsv(`chiusure-${Date.now()}.csv`, buildChiusureCsv(chiusure));
          setMsg("Export chiusure OK");
        }}
        className="w-full py-3 rounded-full glass font-black text-sm"
      >
        CSV CHIUSURE SERATA
      </button>
      <button
        onClick={() => {
          if (!filtered.length) {
            setMsg("Nessun dato per il report");
            return;
          }
          stampaReportPeriodo(filtered, label);
          setMsg("Report aperto per stampa");
        }}
        className="w-full py-3 rounded-full glass font-black text-sm"
      >
        REPORT STAMPABILE (PDF-ish)
      </button>
      {msg && <p className="text-[10px] text-amber-300/90">{msg}</p>}
    </div>
  );
}

export function CassaTab() {
  const scontrini = useCassa((s) => s.scontrini);
  const chiusure = useCassa((s) => s.chiusure);
  const fondo = useCassa((s) => s.fondo);
  const sessione = useAuth((s) => s.sessione);
  const [contato, setContato] = useState(String(fondo));
  const [fondoEdit, setFondoEdit] = useState(String(fondo));
  const [last, setLast] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [voidId, setVoidId] = useState<string | null>(null);
  const [voidReason, setVoidReason] = useState("");
  const [sub, setSub] = useState<"oggi" | "chiusura" | "export">("oggi");

  const oggi = cassaDayKey(Date.now());
  const oggiRows = scontrini.filter((x) => cassaDayKey(x.ts) === oggi);
  const attivi = oggiRows.filter(scontrinoAttivo);
  const tot = attivi.reduce((a, x) => a + x.totale, 0);
  const coperti = attivi.reduce((a, x) => a + x.coperti, 0);
  const mance = attivi.reduce((a, x) => a + (Number(x.mancia) || 0), 0);
  const media = attivi.length ? tot / attivi.length : 0;
  const by = (p: Pagamento) => attivi.filter((x) => x.pagamento === p).reduce((a, x) => a + x.totale, 0);

  // Preview chiusura
  let mistoContanti = 0;
  for (const x of attivi) {
    if (x.pagamento !== "misto") continue;
    if (x.mistoDettaglio) mistoContanti += Number(x.mistoDettaglio.contanti) || 0;
    else mistoContanti += x.totale * 0.5;
  }
  const atteso = fondo + by("contanti") + mistoContanti;
  const diffPreview = (Number(contato) || 0) - atteso;

  return (
    <div className="space-y-3">
      <div className="flex justify-between items-center">
        <h2 className="font-black tracking-widest text-sm">CASSA</h2>
        <div className="flex gap-1">
          {(
            [
              ["oggi", "Oggi"],
              ["chiusura", "Chiusura"],
              ["export", "Export"],
            ] as const
          ).map(([id, lab]) => (
            <button
              key={id}
              onClick={() => setSub(id)}
              className={`px-2.5 py-1 rounded-full text-[9px] font-black ${sub === id ? "bg-[#FF1A1A] text-black" : "glass"}`}
            >
              {lab}
            </button>
          ))}
        </div>
      </div>

      {sub === "export" && <ReportExportBlock />}

      {sub === "oggi" && (
        <>
          <div className="grid grid-cols-2 gap-2">
            <div className="glass rounded-2xl p-3">
              <p className="text-[9px] text-white/40">INCASSO OGGI</p>
              <p className="text-2xl font-black">{euro(tot)}</p>
            </div>
            <div className="glass rounded-2xl p-3">
              <p className="text-[9px] text-white/40">SCONTRINI</p>
              <p className="text-2xl font-black">{attivi.length}</p>
            </div>
            <div className="glass rounded-2xl p-3">
              <p className="text-[9px] text-white/40">COPERTI</p>
              <p className="text-xl font-black">{coperti}</p>
            </div>
            <div className="glass rounded-2xl p-3">
              <p className="text-[9px] text-white/40">MEDIA SCONTRINO</p>
              <p className="text-xl font-black">{euro(media)}</p>
            </div>
            <div className="glass rounded-2xl p-3 col-span-2">
              <p className="text-[9px] text-white/40">MANCE TOTALI</p>
              <p className="text-xl font-black text-emerald-300">{euro(mance)}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            {PAG.map((p) => (
              <div key={p} className="glass rounded-2xl p-3">
                <p className="text-[9px] text-white/40 uppercase">{p}</p>
                <p className="text-lg font-black">{euro(by(p))}</p>
              </div>
            ))}
          </div>

          <p className="text-[10px] tracking-widest text-white/45 font-black pt-1">SCONTRINI OGGI</p>
          {oggiRows.length === 0 && <p className="text-sm text-white/40">Nessuno scontrino oggi — usa PAGA E CHIUDI su un tavolo.</p>}
          {oggiRows.map((s) => (
            <ScontrinoRow
              key={s.id}
              s={s}
              open={expanded === s.id}
              onToggle={() => setExpanded(expanded === s.id ? null : s.id)}
              onVoid={() => {
                setVoidId(s.id);
                setVoidReason("");
              }}
            />
          ))}
        </>
      )}

      {sub === "chiusura" && (
        <>
          <div className="glass-strong rounded-2xl p-4 space-y-3">
            <p className="font-black text-sm">IMPOSTA FONDO CASSA</p>
            <div className="flex gap-2">
              <input
                type="number"
                value={fondoEdit}
                onChange={(e) => setFondoEdit(e.target.value)}
                className="flex-1 p-3 rounded-xl bg-black/30"
              />
              <button
                onClick={() => {
                  useCassa.getState().setFondo(Number(fondoEdit) || 0);
                  setContato(fondoEdit);
                  setLast(`Fondo impostato a ${euro(Number(fondoEdit) || 0)}`);
                }}
                className="px-4 rounded-xl bg-white text-black font-black text-xs"
              >
                SALVA
              </button>
            </div>
            <p className="text-[10px] text-white/40">Fondo attuale: {euro(fondo)}</p>
          </div>

          <div className="glass-strong rounded-2xl p-4 space-y-2">
            <p className="font-black text-sm">CHIUSURA SERATA DETTAGLIATA</p>
            <div className="grid grid-cols-2 gap-2 text-[11px]">
              <div className="glass rounded-xl p-2">
                <p className="text-white/40 text-[9px]">FONDO INIZIALE</p>
                <p className="font-black">{euro(fondo)}</p>
              </div>
              <div className="glass rounded-xl p-2">
                <p className="text-white/40 text-[9px]">CASSA ATTESA</p>
                <p className="font-black">{euro(atteso)}</p>
              </div>
              {PAG.map((p) => (
                <div key={p} className="glass rounded-xl p-2">
                  <p className="text-white/40 text-[9px] uppercase">{p}</p>
                  <p className="font-black">{euro(by(p))}</p>
                </div>
              ))}
              <div className="glass rounded-xl p-2 col-span-2">
                <p className="text-white/40 text-[9px]">MANCE</p>
                <p className="font-black">{euro(mance)}</p>
              </div>
            </div>
            <p className="text-[10px] text-white/40">Inserisci contato reale del cassetto.</p>
            <input
              type="number"
              value={contato}
              onChange={(e) => setContato(e.target.value)}
              className="w-full p-3 rounded-xl bg-black/30"
            />
            <p className={`text-sm font-black ${diffPreview === 0 ? "text-emerald-300" : diffPreview > 0 ? "text-sky-300" : "text-[#FF6B6B]"}`}>
              Differenza preview: {euro(diffPreview)}
            </p>
            <button
              onClick={() => {
                const ch = useCassa.getState().chiudiSerata(Number(contato) || 0, sessione?.staffNome || "Sala");
                setLast(`Chiusura ${euro(ch.totale)} · diff ${euro(ch.differenza)}`);
                setFondoEdit(String(ch.contato));
              }}
              className="w-full py-3 rounded-full bg-[#FF1A1A] text-black font-black"
            >
              CHIUDI SERATA
            </button>
            <button
              onClick={() => {
                if (!chiusure[0]) {
                  setLast("Nessuna chiusura da esportare");
                  return;
                }
                downloadCsv(`chiusura-${chiusure[0].data}.csv`, buildChiusureCsv([chiusure[0]]));
                setLast("CSV chiusura scaricato");
              }}
              className="w-full py-3 rounded-full glass font-black text-sm"
            >
              EXPORT CHIUSURA CSV
            </button>
            {last && <p className="text-[10px] text-white/50">{last}</p>}
          </div>

          <p className="text-[10px] tracking-widest text-white/45 font-black">STORICO ULTIME CHIUSURE</p>
          {chiusure.length === 0 && <p className="text-sm text-white/40">Nessuna chiusura ancora.</p>}
          {chiusure.slice(0, 12).map((c) => (
            <div key={c.id} className="glass rounded-2xl p-3 space-y-1">
              <div className="flex justify-between">
                <span className="font-bold text-sm">{c.data}</span>
                <span className="font-black">{euro(c.totale)}</span>
              </div>
              <p className="text-[10px] text-white/40">
                {c.scontrini} scontrini · {c.coperti} coperti · mance {euro(c.mance || 0)} · {c.operatore}
              </p>
              <p className={`text-[10px] font-bold ${(c.differenza || 0) === 0 ? "text-emerald-300" : (c.differenza || 0) > 0 ? "text-sky-300" : "text-[#FF6B6B]"}`}>
                Diff {euro(c.differenza)} · atteso {euro(c.cassaAttesa)} · contato {euro(c.contato || 0)}
              </p>
              <p className="text-[9px] text-white/30">
                C {euro(c.contanti)} · Carta {euro(c.carta)} · Satispay {euro(c.satispay)} · Misto {euro(c.misto)}
              </p>
            </div>
          ))}
        </>
      )}

      {voidId && (
        <div className="fixed inset-0 z-[60] bg-black/70 flex items-end p-4">
          <div className="w-full max-w-[480px] mx-auto rounded-[24px] glass-strong p-5 space-y-3">
            <p className="font-black">ANNULLA SCONTRINO</p>
            <p className="text-[11px] text-white/50">Verrà escluso dai totali. Indica il motivo.</p>
            <input
              value={voidReason}
              onChange={(e) => setVoidReason(e.target.value)}
              placeholder="Motivo annullamento"
              className="w-full p-3 rounded-xl bg-black/40 border border-white/10 text-sm"
            />
            <div className="flex gap-2">
              <button onClick={() => setVoidId(null)} className="flex-1 py-3 rounded-full glass font-black text-sm">
                ANNULLA
              </button>
              <button
                onClick={() => {
                  useCassa.getState().annulla(voidId, voidReason);
                  setVoidId(null);
                }}
                className="flex-1 py-3 rounded-full bg-[#FF1A1A] text-black font-black text-sm"
              >
                CONFERMA VOID
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ScontrinoRow({
  s,
  open,
  onToggle,
  onVoid,
}: {
  s: ScontrinoCassa;
  open: boolean;
  onToggle: () => void;
  onVoid: () => void;
}) {
  const ann = (s.stato || "emesso") === "annullato";
  const ora = new Date(s.ts).toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" });
  return (
    <div className={`glass rounded-2xl p-3 ${ann ? "opacity-50" : ""}`}>
      <button onClick={onToggle} className="w-full flex justify-between items-center text-left">
        <div>
          <p className="text-sm font-bold">
            {s.tavolo} · {s.pagamento}
            {ann ? " · ANNULLATO" : ""}
          </p>
          <p className="text-[10px] text-white/40">
            {ora} · {s.operatore}
            {s.mancia ? ` · mancia ${euro(s.mancia)}` : ""}
          </p>
        </div>
        <span className="font-black">{euro(s.totale)}</span>
      </button>
      {open && (
        <div className="mt-3 pt-3 border-t border-white/10 space-y-1 text-[11px]">
          {(s.righe || []).map((r, i) => (
            <div key={`${s.id}-r-${i}`} className="flex justify-between text-white/70">
              <span>
                {r.qta}× {r.nome}
                {r.note ? ` (${r.note})` : ""}
              </span>
              <span>{euro(r.qta * r.prezzo)}</span>
            </div>
          ))}
          {s.sconto > 0 && <p className="text-white/50">Sconto -{euro(s.sconto)}</p>}
          {s.mancia > 0 && <p className="text-emerald-300/80">Mancia {euro(s.mancia)}</p>}
          {s.splitDettaglio?.length ? (
            <div className="pt-1">
              <p className="text-white/40 text-[9px]">SPLIT</p>
              {s.splitDettaglio.map((sp, i) => (
                <p key={i} className="text-white/60">
                  {sp.label}: {euro(sp.importo)} · {sp.pagamento}
                </p>
              ))}
            </div>
          ) : null}
          {s.riferimentoPos ? <p className="text-white/40">POS: {s.riferimentoPos}</p> : null}
          {s.noteFiscali ? <p className="text-white/40 italic">{s.noteFiscali}</p> : null}
          {ann && s.motivoAnnullamento ? <p className="text-[#FF6B6B]">Motivo: {s.motivoAnnullamento}</p> : null}
          {!ann && (
            <button onClick={onVoid} className="mt-2 w-full py-2 rounded-full bg-white/10 text-[10px] font-black text-[#FF6B6B]">
              ANNULLA SCONTRINO
            </button>
          )}
        </div>
      )}
    </div>
  );
}
