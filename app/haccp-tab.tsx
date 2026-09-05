"use client";

import { useState } from "react";
import { useMenteStore } from "@/lib/store";
import { useLocaleStore } from "@/lib/locale-store";
import type { HaccpView, PrinterMode } from "@/lib/types";
import { buildAslCsv, buildTempOnlyCsv, downloadAslFile, downloadTempLog } from "@/lib/haccp-export";

const inp = "w-full p-3 rounded-xl bg-black/30 border border-white/10 mt-2";

const CARDS: { id: HaccpView; title: string; sub: string; bg: string; icon: string }[] = [
  { id: "fornitori", title: "Fornitori", sub: "Lista e gestione fornitori", bg: "#3B82F6", icon: "🚚" },
  { id: "pulizia", title: "Pulizia", sub: "Checklist e scadenze", bg: "#22C55E", icon: "🧹" },
  { id: "scadenze", title: "Scadenze", sub: "Controllo prodotti", bg: "#EF4444", icon: "📅" },
  { id: "frighi", title: "Frigoriferi", sub: "Temperatura e log", bg: "#3B82F6", icon: "❄️" },
  { id: "olio", title: "Controllo Olio", sub: "Qualità e filtri", bg: "#EAB308", icon: "🛢️" },
  { id: "tracciabilita", title: "Tracciabilità", sub: "Lotti e prodotti", bg: "#8B5CF6", icon: "🔢" },
  { id: "etichetta", title: "Etichetta Rapida", sub: "Stampa etichette", bg: "#EC4899", icon: "🏷️" },
  { id: "abbattimento", title: "Abbattimento", sub: "Log e controlli", bg: "#06B6D4", icon: "🌡️" },
];

function Back({ onClick, title }: { onClick: () => void; title: string }) {
  return (
    <div className="flex items-center gap-3 mb-4">
      <button onClick={onClick} className="w-9 h-9 rounded-full bg-white/10">←</button>
      <h2 className="font-black tracking-widest text-sm">{title}</h2>
    </div>
  );
}

export function HaccpTab() {
  const [view, setView] = useState<HaccpView>("hub");
  const magazzino = useMenteStore((s) => s.magazzino);
  const lotti = useMenteStore((s) => s.lotti || []);
  const frighi = useMenteStore((s) => s.frighi);
  const pulizie = useMenteStore((s) => s.pulizie || []);
  const logTemp = useMenteStore((s) => s.logTemp || []);
  const printer = useMenteStore((s) => s.printer);
  const fornitori = useLocaleStore((s) => s.fornitori);
  const oli = useLocaleStore((s) => s.oli);
  const abbattimenti = useLocaleStore((s) => s.abbattimenti);
  const [tempDraft, setTempDraft] = useState<Record<string, string>>({});
  const [fo, setFo] = useState({ nome: "", categoria: "", telefono: "", note: "" });
  const [clean, setClean] = useState({ zona: "", operatore: "Sala", note: "" });
  const [frigoForm, setFrigoForm] = useState({ nome: "", temp: "2", min: "0", max: "4" });
  const [olioForm, setOlioForm] = useState({ vasca: "Friggitrice 1", polarita: "18", filtro: "Cambio filtro" });
  const [abForm, setAbForm] = useState({ prodotto: "", tInizio: "68", tFine: "3", operatore: "Cucina" });
  const [eti, setEti] = useState({ prodotto: "", produzione: "", scadenza: "", lotto: "", operatore: "", note: "Conservare in frigo 0-4°C", qta: "1" });
  const [msg, setMsg] = useState("");

  const stampaEti = async () => {
    if (eti.prodotto) {
      useMenteStore.getState().creaLotto({ prodotto: eti.prodotto, lotto: eti.lotto, scadenza: eti.scadenza, operatore: eti.operatore, note: eti.note, produzione: eti.produzione });
    }
    const zpl = `^XA^FO40,40^A0N,28,28^FD${(eti.prodotto || "PRODOTTO").toUpperCase()}^FS^FO40,80^A0N,18,18^FDPROD:${eti.produzione} SCAD:${eti.scadenza}^FS^FO40,110^A0N,18,18^FDLOTTO ${eti.lotto}  ${eti.operatore}^FS^FO40,140^A0N,16,16^FD${eti.note}^FS^FO40,180^BQN,2,4^FDQA,${eti.lotto}^FS^XZ`;
    try {
      const res = await fetch("/api/print", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ zpl, mode: printer.mode, ip: printer.ip, port: printer.port, btName: printer.btName, httpsUrl: printer.httpsUrl, copies: Number(eti.qta) || 1 }) });
      const data = await res.json();
      setMsg(data.note || "Etichetta inviata");
    } catch { setMsg("ZPL pronto offline"); }
  };

  if (view === "hub") {
    return (
      <div>
        <h2 className="font-black tracking-widest text-sm mb-3">HACCP</h2>
        <div className="grid grid-cols-2 gap-3">
          {CARDS.map((c) => (
            <button key={c.id} onClick={() => setView(c.id)} className="rounded-[22px] glass-strong p-4 text-left min-h-[118px]">
              <div className="w-11 h-11 rounded-2xl flex items-center justify-center text-xl mb-3" style={{ background: c.bg }}>{c.icon}</div>
              <p className="font-black">{c.title}</p>
              <p className="text-[10px] text-white/40 mt-1">{c.sub}</p>
            </button>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-3 mt-3">
          <button onClick={() => setView("stampante")} className="rounded-[22px] glass p-4 text-left"><p className="font-black text-sm">Stampante</p><p className="text-[10px] text-white/40">ZPL • BT • HTTPS</p></button>
          <button onClick={() => setView("asl")} className="rounded-[22px] glass-strong p-4 text-left border border-[#FF1A1A]/30"><p className="font-black text-sm text-[#FF1A1A]">EXPORT ASL</p><p className="text-[10px] text-white/40">Registro completo CSV</p></button>
        </div>
      </div>
    );
  }

  if (view === "fornitori") {
    return (
      <div>
        <Back onClick={() => setView("hub")} title="FORNITORI" />
        {fornitori.map((f) => (
          <div key={f.id} className="glass rounded-2xl p-3 mb-2 flex justify-between">
            <div><p className="font-bold">{f.nome}</p><p className="text-[10px] text-white/40">{f.categoria} • {f.telefono}</p></div>
            <button onClick={() => useLocaleStore.getState().deleteFornitore(f.id)} className="text-[10px] text-[#FF6B6B]">X</button>
          </div>
        ))}
        <input className={inp} placeholder="Nome" value={fo.nome} onChange={(e) => setFo({ ...fo, nome: e.target.value })} />
        <input className={inp} placeholder="Categoria" value={fo.categoria} onChange={(e) => setFo({ ...fo, categoria: e.target.value })} />
        <input className={inp} placeholder="Telefono" value={fo.telefono} onChange={(e) => setFo({ ...fo, telefono: e.target.value })} />
        <button onClick={() => { useLocaleStore.getState().addFornitore(fo); setFo({ nome: "", categoria: "", telefono: "", note: "" }); }} className="w-full mt-3 py-3 rounded-full bg-white text-black font-black">+ FORNITORE</button>
      </div>
    );
  }

  if (view === "pulizia") {
    return (
      <div>
        <Back onClick={() => setView("hub")} title="PULIZIA" />
        {pulizie.map((p) => (
          <div key={p.id} className="glass rounded-2xl p-3 mb-2 flex justify-between items-center">
            <button onClick={() => useMenteStore.getState().togglePulizia(p.id)} className="text-left flex-1">
              <p className={p.fatto ? "line-through text-white/40" : "font-bold"}>{p.zona}</p>
              <p className="text-[10px] text-white/40">{p.operatore} • {p.fatto ? "FATTO" : "DA FARE"}</p>
            </button>
            <button onClick={() => useMenteStore.getState().deletePulizia(p.id)} className="text-[10px] text-[#FF6B6B]">X</button>
          </div>
        ))}
        <input className={inp} placeholder="Zona" value={clean.zona} onChange={(e) => setClean({ ...clean, zona: e.target.value })} />
        <input className={inp} placeholder="Operatore" value={clean.operatore} onChange={(e) => setClean({ ...clean, operatore: e.target.value })} />
        <button onClick={() => { useMenteStore.getState().addPulizia(clean); setClean({ zona: "", operatore: "Sala", note: "" }); }} className="w-full mt-3 py-3 rounded-full bg-white text-black font-black">+ ZONA</button>
      </div>
    );
  }

  if (view === "scadenze") {
    return (
      <div>
        <Back onClick={() => setView("hub")} title="SCADENZE" />
        {lotti.map((l) => (
          <div key={l.id} className="glass rounded-2xl p-3 mb-2 flex justify-between">
            <div><p className="font-bold">{l.prodotto}</p><p className="text-[10px] text-white/40">{l.lotto} • scad {l.scadenza}</p></div>
            <span className={l.giorni_rimasti <= 2 ? "text-[#FF6B6B] font-black" : "text-white/40"}>{l.giorni_rimasti}gg</span>
          </div>
        ))}
        {magazzino.filter((m) => m.qta < m.soglia).map((m) => (
          <div key={m.id} className="glass rounded-2xl p-3 mb-2 text-sm text-[#FF6B6B]">{m.nome} sotto scorta ({m.qta} {m.unita})</div>
        ))}
      </div>
    );
  }

  if (view === "frighi") {
    return (
      <div>
        <Back onClick={() => setView("hub")} title="FRIGORIFERI" />
        <p className="text-[10px] text-white/40 mb-2">IA Socio ricorda alle 17-19-21-23. Clicca AGGIORNATO.</p>
        {frighi.map((f) => {
          const fuori = f.temp < f.min || f.temp > f.max;
          const stale = !f.lastCheck || Date.now() - f.lastCheck > 110 * 60 * 1000;
          return (
            <div key={f.id} className="glass rounded-2xl p-3 mb-2">
              <div className="flex justify-between"><input className="bg-transparent font-bold flex-1" value={f.nome} onChange={(e) => useMenteStore.getState().updateFrigo(f.id, { nome: e.target.value })} /><button onClick={() => useMenteStore.getState().deleteFrigo(f.id)} className="text-[10px] text-[#FF6B6B]">X</button></div>
              <p className={`text-2xl font-black ${fuori ? "text-[#FF1A1A]" : "text-emerald-400"}`}>{f.temp.toFixed(1)}°C {stale && <span className="text-[10px] text-amber-400">DA AGGIORNARE</span>}</p>
              <div className="flex gap-2 mt-2 items-center text-xs">
                <input type="number" className="w-16 bg-black/30 rounded-lg p-2" placeholder="°C" value={tempDraft[f.id] || ""} onChange={(e) => setTempDraft({ ...tempDraft, [f.id]: e.target.value })} />
                <button onClick={() => { const n = Number(tempDraft[f.id]); if (tempDraft[f.id] !== "" && !Number.isNaN(n)) useMenteStore.getState().salvaTemp(f.id, n); else useMenteStore.getState().confermaTemp(f.id); }} className="px-3 py-2 rounded-full bg-[#FF1A1A] text-black font-black">AGGIORNATO</button>
              </div>
            </div>
          );
        })}
        <input className={inp} placeholder="Nome frigo" value={frigoForm.nome} onChange={(e) => setFrigoForm({ ...frigoForm, nome: e.target.value })} />
        <div className="grid grid-cols-2 gap-2"><input className={inp} placeholder="min" value={frigoForm.min} onChange={(e) => setFrigoForm({ ...frigoForm, min: e.target.value })} /><input className={inp} placeholder="max" value={frigoForm.max} onChange={(e) => setFrigoForm({ ...frigoForm, max: e.target.value })} /></div>
        <button onClick={() => { useMenteStore.getState().addFrigo(frigoForm); setFrigoForm({ nome: "", temp: "2", min: "0", max: "4" }); }} className="w-full mt-3 py-3 rounded-full bg-white text-black font-black">+ FRIGO</button>
      </div>
    );
  }

  if (view === "olio") {
    return (
      <div>
        <Back onClick={() => setView("hub")} title="CONTROLLO OLIO" />
        {oli.map((o) => (
          <div key={o.id} className="glass rounded-2xl p-3 mb-2 flex justify-between">
            <div><p className="font-bold">{o.vasca}</p><p className="text-[10px] text-white/40">polarità {o.polarita}% • {o.filtro}</p></div>
            <span className={o.ok ? "text-emerald-400 text-[10px]" : "text-[#FF6B6B] text-[10px]"}>{o.ok ? "OK" : "CAMBIA"}</span>
          </div>
        ))}
        <input className={inp} placeholder="Vasca" value={olioForm.vasca} onChange={(e) => setOlioForm({ ...olioForm, vasca: e.target.value })} />
        <input className={inp} placeholder="Polarità %" value={olioForm.polarita} onChange={(e) => setOlioForm({ ...olioForm, polarita: e.target.value })} />
        <button onClick={() => useLocaleStore.getState().addOlio(olioForm)} className="w-full mt-3 py-3 rounded-full bg-white text-black font-black">REGISTRA</button>
      </div>
    );
  }

  if (view === "tracciabilita") {
    return (
      <div>
        <Back onClick={() => setView("hub")} title="TRACCIABILITÀ" />
        {lotti.map((l) => (
          <div key={l.id} className="glass rounded-2xl p-3 mb-2 flex justify-between">
            <div><p className="font-bold">{l.prodotto}</p><p className="text-[10px] text-white/40">{l.lotto} • {l.operatore} • {l.note || "—"}</p></div>
            <button onClick={() => useMenteStore.getState().deleteLotto(l.id)} className="text-[10px] text-[#FF6B6B]">X</button>
          </div>
        ))}
      </div>
    );
  }

  if (view === "etichetta") {
    return (
      <div>
        <Back onClick={() => setView("hub")} title="ETICHETTA RAPIDA" />
        <label className="text-[10px] text-white/40">Nome Prodotto *</label>
        <input className={inp + " mt-1"} placeholder="Es. Salsa di pomodoro" value={eti.prodotto} onChange={(e) => setEti({ ...eti, prodotto: e.target.value })} />
        <label className="text-[10px] text-white/40 mt-3 block">Data Produzione</label>
        <input type="date" className={inp + " mt-1"} value={eti.produzione} onChange={(e) => setEti({ ...eti, produzione: e.target.value })} />
        <label className="text-[10px] text-white/40 mt-3 block">Data Scadenza</label>
        <input type="date" className={inp + " mt-1"} value={eti.scadenza} onChange={(e) => setEti({ ...eti, scadenza: e.target.value })} />
        <label className="text-[10px] text-white/40 mt-3 block">Lotto</label>
        <input className={inp + " mt-1"} placeholder="Lotto" value={eti.lotto} onChange={(e) => setEti({ ...eti, lotto: e.target.value })} />
        <label className="text-[10px] text-white/40 mt-3 block">Operator</label>
        <input className={inp + " mt-1"} placeholder="Nome" value={eti.operatore} onChange={(e) => setEti({ ...eti, operatore: e.target.value })} />
        <label className="text-[10px] text-white/40 mt-3 block">Note / Conservazione</label>
        <input className={inp + " mt-1"} value={eti.note} onChange={(e) => setEti({ ...eti, note: e.target.value })} />
        <label className="text-[10px] text-white/40 mt-3 block">Quantità etichette</label>
        <input type="number" className={inp + " mt-1"} value={eti.qta} onChange={(e) => setEti({ ...eti, qta: e.target.value })} />
        <button onClick={() => void stampaEti()} className="w-full mt-4 py-3 rounded-full bg-[#FF1A1A] text-black font-black">GENERA E STAMPA</button>
        {msg && <p className="text-[10px] text-white/40 mt-2">{msg}</p>}
      </div>
    );
  }

  if (view === "abbattimento") {
    return (
      <div>
        <Back onClick={() => setView("hub")} title="ABBATTIMENTO" />
        {abbattimenti.map((a) => (
          <div key={a.id} className="glass rounded-2xl p-3 mb-2">
            <p className="font-bold">{a.prodotto}</p>
            <p className="text-[10px] text-white/40">{a.tInizio}°C → {a.tFine}°C • {a.operatore}</p>
          </div>
        ))}
        <input className={inp} placeholder="Prodotto" value={abForm.prodotto} onChange={(e) => setAbForm({ ...abForm, prodotto: e.target.value })} />
        <div className="grid grid-cols-2 gap-2"><input className={inp} placeholder="T inizio" value={abForm.tInizio} onChange={(e) => setAbForm({ ...abForm, tInizio: e.target.value })} /><input className={inp} placeholder="T fine" value={abForm.tFine} onChange={(e) => setAbForm({ ...abForm, tFine: e.target.value })} /></div>
        <button onClick={() => useLocaleStore.getState().addAbbattimento(abForm)} className="w-full mt-3 py-3 rounded-full bg-white text-black font-black">REGISTRA</button>
      </div>
    );
  }

  if (view === "stampante") {
    return (
      <div>
        <Back onClick={() => setView("hub")} title="STAMPANTE" />
        <div className="flex gap-2">{(["zpl", "bt", "https"] as PrinterMode[]).map((m) => (
          <button key={m} onClick={() => useMenteStore.getState().setPrinter({ mode: m })} className={`flex-1 py-2 rounded-full text-[10px] font-black ${printer.mode === m ? "bg-[#FF1A1A] text-black" : "bg-white/10"}`}>{m.toUpperCase()}</button>
        ))}</div>
        {printer.mode === "zpl" && <div className="grid grid-cols-3 gap-2 mt-2"><input className={inp + " col-span-2 mt-0"} placeholder="IP" value={printer.ip} onChange={(e) => useMenteStore.getState().setPrinter({ ip: e.target.value })} /><input className={inp + " mt-0"} placeholder="9100" value={printer.port} onChange={(e) => useMenteStore.getState().setPrinter({ port: e.target.value })} /></div>}
        {printer.mode === "bt" && <input className={inp} placeholder="Nome BT" value={printer.btName} onChange={(e) => useMenteStore.getState().setPrinter({ btName: e.target.value })} />}
        {printer.mode === "https" && <input className={inp} placeholder="https://..." value={printer.httpsUrl} onChange={(e) => useMenteStore.getState().setPrinter({ httpsUrl: e.target.value })} />}
      </div>
    );
  }

  return (
    <div>
      <Back onClick={() => setView("hub")} title="EXPORT ASL" />
      <p className="text-sm text-white/50 mb-2">Registro completo per controllo ASL: lotti, magazzino, frighi, temperature, pulizie.</p>
      <button
        onClick={() => downloadAslFile(buildAslCsv({ lotti, magazzino, frighi, logTemp, pulizie }))}
        className="w-full mt-2 py-5 rounded-[20px] bg-[#FF1A1A] text-black font-black text-base tracking-wide shadow-lg"
      >
        EXPORT ASL
      </button>
      <button
        onClick={() => {
          if (!logTemp.length) { setMsg("Nessun log temperature ancora"); return; }
          downloadTempLog(buildTempOnlyCsv(logTemp));
          setMsg("Log temperature esportato");
        }}
        className="w-full mt-3 py-3 rounded-full glass font-black text-sm"
      >
        CSV SOLO TEMPERATURE
      </button>
      <button
        onClick={() => downloadAslFile(buildAslCsv({ lotti, magazzino, frighi, logTemp, pulizie }))}
        className="w-full mt-2 py-3 rounded-full bg-white text-black font-black text-sm"
      >
        SCARICA FILE ASL (CSV)
      </button>
      {msg && <p className="text-[10px] text-white/40 mt-2">{msg}</p>}
    </div>
  );
}
