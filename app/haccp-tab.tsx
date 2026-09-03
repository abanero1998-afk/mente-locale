"use client";

import { useState } from "react";
import { useMenteStore } from "@/lib/store";
import type { PrinterMode } from "@/lib/types";
import { buildAslCsv, downloadAslFile } from "@/lib/haccp-export";

const inp = "w-full p-3 rounded-xl bg-black/30 border border-[#FF1A1A]/10 mt-2";

export function HaccpTab() {
  const magazzino = useMenteStore((s) => s.magazzino);
  const lotti = useMenteStore((s) => s.lotti || []);
  const frighi = useMenteStore((s) => s.frighi);
  const pulizie = useMenteStore((s) => s.pulizie || []);
  const logTemp = useMenteStore((s) => s.logTemp || []);
  const printer = useMenteStore((s) => s.printer || { mode: "zpl" as PrinterMode, ip: "", port: "9100", btName: "", httpsUrl: "" });
  const [magForm, setMagForm] = useState({ nome: "", qta: "", unita: "kg", soglia: "1" });
  const [lottoForm, setLottoForm] = useState({ prodotto: "", lotto: "", scadenza: new Date().toISOString().slice(0, 10) });
  const [frigoForm, setFrigoForm] = useState({ nome: "", temp: "2", min: "0", max: "4" });
  const [cleanForm, setCleanForm] = useState({ zona: "", operatore: "Sala", note: "" });
  const [tempDraft, setTempDraft] = useState<Record<string, string>>({});
  const [editLotto, setEditLotto] = useState<string | null>(null);
  const [printMsg, setPrintMsg] = useState("");

  const stampa = async () => {
    const zpl = `^XA^FO50,50^A0N,30,30^FD${(lottoForm.prodotto || "PRODOTTO").toUpperCase()}^FS^FO50,100^A0N,20,20^FDSCAD:${lottoForm.scadenza}^FS^FO50,130^BQN,2,4^FDQA,LOTTO${lottoForm.lotto || "X"}^FS^XZ`;
    if (lottoForm.prodotto) useMenteStore.getState().creaLotto(lottoForm);
    try {
      const res = await fetch("/api/print", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ zpl, mode: printer.mode, ip: printer.ip, port: printer.port, btName: printer.btName, httpsUrl: printer.httpsUrl }),
      });
      const data = await res.json();
      setPrintMsg(data.note || "ZPL inviato");
    } catch {
      setPrintMsg("ZPL generato offline");
    }
  };

  const scaricaAsl = () => {
    const csv = buildAslCsv({ lotti, magazzino, frighi, logTemp, pulizie });
    downloadAslFile(csv);
  };

  return (
    <div className="grid gap-4">
      <div className="glass-strong rounded-[24px] p-5">
        <h3 className="font-black">📦 MAGAZZINO</h3>
        {magazzino.map((m) => (
          <div key={m.id} className="p-3 rounded-xl bg-white/5 mt-2">
            <div className="flex justify-between gap-2">
              <input className="bg-transparent flex-1 font-semibold" value={m.nome} onChange={(e) => useMenteStore.getState().updateMag(m.id, { nome: e.target.value })} />
              <button onClick={() => useMenteStore.getState().deleteMag(m.id)} className="text-[10px] text-[#FF6B6B]">ELIMINA</button>
            </div>
            <div className="flex gap-2 mt-2 text-xs">
              <input type="number" className="w-16 bg-black/30 rounded-lg p-1" value={m.qta} onChange={(e) => useMenteStore.getState().updateMag(m.id, { qta: Number(e.target.value) })} />
              <input className="w-12 bg-black/30 rounded-lg p-1" value={m.unita} onChange={(e) => useMenteStore.getState().updateMag(m.id, { unita: e.target.value })} />
              <span className="text-white/30 self-center">soglia</span>
              <input type="number" className="w-14 bg-black/30 rounded-lg p-1" value={m.soglia} onChange={(e) => useMenteStore.getState().updateMag(m.id, { soglia: Number(e.target.value) })} />
              <span className={m.qta < m.soglia ? "text-[#FF6B6B] self-center" : "text-emerald-400 self-center"}>{m.qta < m.soglia ? "scorta" : "ok"}</span>
            </div>
          </div>
        ))}
        <div className="grid grid-cols-4 gap-2 mt-3">
          <input placeholder="Nome" className={inp + " col-span-2 mt-0"} value={magForm.nome} onChange={(e) => setMagForm({ ...magForm, nome: e.target.value })} />
          <input placeholder="Qta" type="number" className={inp + " mt-0"} value={magForm.qta} onChange={(e) => setMagForm({ ...magForm, qta: e.target.value })} />
          <input placeholder="kg" className={inp + " mt-0"} value={magForm.unita} onChange={(e) => setMagForm({ ...magForm, unita: e.target.value })} />
        </div>
        <button onClick={() => { useMenteStore.getState().addMag(magForm); setMagForm({ nome: "", qta: "", unita: "kg", soglia: "1" }); }} className="w-full mt-2 py-2 rounded-full bg-white/10 text-xs font-black">+ ARTICOLO</button>
      </div>

      <div className="glass-strong rounded-[24px] p-5">
        <h3 className="font-black">📦 LOTTI ATTIVI</h3>
        {lotti.map((l) => (
          <div key={l.id} className="p-3 rounded-xl bg-white/5 mt-2 text-sm">
            {editLotto === l.id ? (
              <div className="space-y-2">
                <input className={inp + " mt-0"} value={l.prodotto} onChange={(e) => useMenteStore.getState().updateLotto(l.id, { prodotto: e.target.value })} />
                <input className={inp + " mt-0"} value={l.lotto} onChange={(e) => useMenteStore.getState().updateLotto(l.id, { lotto: e.target.value })} />
                <input type="date" className={inp + " mt-0"} value={l.scadenza} onChange={(e) => useMenteStore.getState().updateLotto(l.id, { scadenza: e.target.value })} />
                <button onClick={() => setEditLotto(null)} className="text-[10px]">OK</button>
              </div>
            ) : (
              <div className="flex justify-between gap-2 items-center">
                <span>{l.prodotto} • {l.lotto} • Scad {l.scadenza}</span>
                <span className="flex gap-2 items-center">
                  <span className={l.giorni_rimasti <= 2 ? "text-red-400" : "text-white/50"}>{l.giorni_rimasti}gg</span>
                  <button onClick={() => setEditLotto(l.id)} className="text-[10px] text-white/50">MOD</button>
                  <button onClick={() => useMenteStore.getState().deleteLotto(l.id)} className="text-[10px] text-[#FF6B6B]">X</button>
                </span>
              </div>
            )}
          </div>
        ))}
        <input placeholder="Prodotto" className={inp} value={lottoForm.prodotto} onChange={(e) => setLottoForm({ ...lottoForm, prodotto: e.target.value })} />
        <input placeholder="Lotto" className={inp} value={lottoForm.lotto} onChange={(e) => setLottoForm({ ...lottoForm, lotto: e.target.value })} />
        <input type="date" className={inp} value={lottoForm.scadenza} onChange={(e) => setLottoForm({ ...lottoForm, scadenza: e.target.value })} />
        <div className="grid grid-cols-2 gap-2 mt-3">
          <button onClick={() => { useMenteStore.getState().creaLotto(lottoForm); setLottoForm({ ...lottoForm, prodotto: "", lotto: "" }); }} className="py-3 rounded-full bg-white/10 font-black text-xs">+ LOTTO</button>
          <button onClick={() => void stampa()} className="py-3 bg-[#FF1A1A] text-black rounded-full font-black text-xs">STAMPA 70x40</button>
        </div>
        {printMsg && <p className="text-[10px] text-white/40 mt-2">{printMsg}</p>}
      </div>

      <div className="glass-strong rounded-[24px] p-5">
        <h3 className="font-black">🌡️ TEMPERATURA FRIGHI • 17–23 OGNI 2H</h3>
        <p className="text-[10px] text-white/40 mt-1">IA Socio notifica alle 17, 19, 21, 23. Clicca AGGIORNATO dopo la lettura.</p>
        {frighi.map((f) => {
          const fuori = f.temp < f.min || f.temp > f.max;
          const stale = !f.lastCheck || Date.now() - f.lastCheck > 110 * 60 * 1000;
          return (
            <div key={f.id} className="mt-3 p-3 rounded-xl bg-white/5">
              <div className="flex justify-between">
                <input className="bg-transparent font-semibold flex-1" value={f.nome} onChange={(e) => useMenteStore.getState().updateFrigo(f.id, { nome: e.target.value })} />
                <button onClick={() => useMenteStore.getState().deleteFrigo(f.id)} className="text-[10px] text-[#FF6B6B]">ELIMINA</button>
              </div>
              <p className={`text-xl font-black ${fuori ? "text-[#FF1A1A]" : "text-emerald-400"}`}>{f.temp.toFixed(1)}°C {stale ? <span className="text-[10px] text-amber-400">DA AGGIORNARE</span> : null}</p>
              <div className="flex gap-2 mt-2 items-center text-xs">
                <span>min</span>
                <input type="number" className="w-12 bg-black/30 rounded-lg p-1" value={f.min} onChange={(e) => useMenteStore.getState().updateFrigo(f.id, { min: Number(e.target.value) })} />
                <span>max</span>
                <input type="number" className="w-12 bg-black/30 rounded-lg p-1" value={f.max} onChange={(e) => useMenteStore.getState().updateFrigo(f.id, { max: Number(e.target.value) })} />
                <input type="number" placeholder="°C" className="w-16 bg-black/30 rounded-lg p-1" value={tempDraft[f.id] || ""} onChange={(e) => setTempDraft({ ...tempDraft, [f.id]: e.target.value })} />
                <button onClick={() => { const n = Number(tempDraft[f.id]); if (!Number.isNaN(n) && tempDraft[f.id] !== "") useMenteStore.getState().salvaTemp(f.id, n); else useMenteStore.getState().confermaTemp(f.id); }} className="px-3 py-1 rounded-full bg-[#FF1A1A] text-black font-black">AGGIORNATO</button>
              </div>
            </div>
          );
        })}
        <div className="grid grid-cols-4 gap-2 mt-3">
          <input placeholder="Nome frigo" className={inp + " col-span-2 mt-0"} value={frigoForm.nome} onChange={(e) => setFrigoForm({ ...frigoForm, nome: e.target.value })} />
          <input placeholder="min" type="number" className={inp + " mt-0"} value={frigoForm.min} onChange={(e) => setFrigoForm({ ...frigoForm, min: e.target.value })} />
          <input placeholder="max" type="number" className={inp + " mt-0"} value={frigoForm.max} onChange={(e) => setFrigoForm({ ...frigoForm, max: e.target.value })} />
        </div>
        <button onClick={() => { useMenteStore.getState().addFrigo(frigoForm); setFrigoForm({ nome: "", temp: "2", min: "0", max: "4" }); }} className="w-full mt-2 py-2 rounded-full bg-white/10 text-xs font-black">+ FRIGO</button>
      </div>

      <div className="glass-strong rounded-[24px] p-5">
        <h3 className="font-black">🧼 PULIZIA LOCALE</h3>
        {pulizie.map((p) => (
          <div key={p.id} className="flex justify-between items-center p-3 rounded-xl bg-white/5 mt-2">
            <button onClick={() => useMenteStore.getState().togglePulizia(p.id)} className="text-left flex-1">
              <p className={p.fatto ? "line-through text-white/40" : "font-semibold"}>{p.zona}</p>
              <p className="text-[10px] text-white/40">{p.operatore} • {p.fatto ? "FATTO" : "DA FARE"} • {p.note}</p>
            </button>
            <button onClick={() => useMenteStore.getState().deletePulizia(p.id)} className="text-[10px] text-[#FF6B6B]">X</button>
          </div>
        ))}
        <input placeholder="Zona es Cucina" className={inp} value={cleanForm.zona} onChange={(e) => setCleanForm({ ...cleanForm, zona: e.target.value })} />
        <input placeholder="Operatore" className={inp} value={cleanForm.operatore} onChange={(e) => setCleanForm({ ...cleanForm, operatore: e.target.value })} />
        <input placeholder="Note" className={inp} value={cleanForm.note} onChange={(e) => setCleanForm({ ...cleanForm, note: e.target.value })} />
        <button onClick={() => { useMenteStore.getState().addPulizia(cleanForm); setCleanForm({ zona: "", operatore: "Sala", note: "" }); }} className="w-full mt-2 py-2 rounded-full bg-white/10 text-xs font-black">+ ZONA PULIZIA</button>
      </div>

      <div className="glass-strong rounded-[24px] p-5">
        <h3 className="font-black">🖨️ STAMPANTE ETICHETTE</h3>
        <div className="flex gap-2 mt-3">
          {(["zpl", "bt", "https"] as PrinterMode[]).map((m) => (
            <button key={m} onClick={() => useMenteStore.getState().setPrinter({ mode: m })} className={`flex-1 py-2 rounded-full text-[10px] font-black ${printer.mode === m ? "bg-[#FF1A1A] text-black" : "bg-white/10"}`}>{m.toUpperCase()}</button>
          ))}
        </div>
        {printer.mode === "zpl" && (
          <div className="grid grid-cols-3 gap-2 mt-2">
            <input className={inp + " col-span-2 mt-0"} placeholder="IP 192.168.1.80" value={printer.ip} onChange={(e) => useMenteStore.getState().setPrinter({ ip: e.target.value })} />
            <input className={inp + " mt-0"} placeholder="9100" value={printer.port} onChange={(e) => useMenteStore.getState().setPrinter({ port: e.target.value })} />
          </div>
        )}
        {printer.mode === "bt" && (
          <input className={inp} placeholder="Nome Bluetooth es Zebra-ZQ520" value={printer.btName} onChange={(e) => useMenteStore.getState().setPrinter({ btName: e.target.value })} />
        )}
        {printer.mode === "https" && (
          <input className={inp} placeholder="https://printer.local/zpl" value={printer.httpsUrl} onChange={(e) => useMenteStore.getState().setPrinter({ httpsUrl: e.target.value })} />
        )}
        <p className="text-[10px] text-white/35 mt-2">ZPL = rete IP:9100 • BT = Web Bluetooth telefono • HTTPS = gateway cloud/locale</p>
      </div>

      <div className="glass-strong rounded-[24px] p-5">
        <h3 className="font-black">📄 EXPORT ASL</h3>
        <p className="text-xs text-white/40 mt-2">File CSV con lotti, magazzino, temperature, log e pulizie. Si scarica sul telefono.</p>
        <button onClick={scaricaAsl} className="w-full mt-3 py-3 bg-white text-black rounded-full font-black">📥 SCARICA FILE ASL</button>
        <a href="/api/asl" className="block text-center text-[10px] text-white/40 mt-2">oppure modello vuoto</a>
      </div>
    </div>
  );
}
