"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import {
  useFiscal,
  isProfiloCompleto,
  type AliquotaIva,
  type PosProvider,
  type RtVendor,
} from "@/lib/fiscal";

const BADGE_LABEL: Record<string, string> = {
  mancante: "Mancante",
  configurato: "Configurato",
  rt_online: "RT online",
  rt_offline: "RT offline",
};

const BADGE_CLASS: Record<string, string> = {
  mancante: "bg-amber-500/20 text-amber-200",
  configurato: "bg-sky-500/20 text-sky-200",
  rt_online: "bg-emerald-500/20 text-emerald-200",
  rt_offline: "bg-red-500/30 text-red-200",
};

export function FiscalSettingsPanel() {
  const sessione = useAuth((s) => s.sessione);
  const fiscal = useFiscal();
  const [msg, setMsg] = useState("");
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    fiscal.loadFromTenant();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessione?.localeId]);

  if (!sessione || sessione.ruolo !== "titolare") return null;

  const badge = fiscal.statusBadge();
  const completo = isProfiloCompleto(fiscal.profilo);

  const salva = () => {
    const piva = (fiscal.profilo.partitaIva || "").replace(/\D/g, "");
    if (piva && piva.length !== 11) {
      setMsg("P.IVA deve essere di 11 cifre");
      return;
    }
    fiscal.setProfilo({ partitaIva: piva });
    fiscal.syncToTenant();
    setMsg("Configurazione fiscale salvata");
    setTimeout(() => setMsg(""), 2500);
  };

  const testRt = async () => {
    setTesting(true);
    setMsg("Test connessione RT…");
    const res = await fiscal.testRt();
    setTesting(false);
    setMsg(res.ok ? "RT raggiungibile" : res.error || "RT non raggiungibile");
  };

  return (
    <div className="rounded-[24px] glass-strong p-4 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[10px] tracking-widest text-white/45 font-black">FISCALE / RT</p>
        <span className={`text-[9px] font-black px-2 py-1 rounded-full ${BADGE_CLASS[badge] || ""}`}>
          {BADGE_LABEL[badge] || badge}
        </span>
      </div>
      <p className="text-[10px] text-white/35">
        Software layer verso Registratore Telematico in LAN (Epson FpMate / 3i XonXoff). Non è certificazione fiscale.
      </p>

      <p className="text-[10px] text-white/50 font-black pt-1">DATI FISCALE</p>
      <div>
        <label className="text-[9px] text-white/40">Partita IVA (11 cifre)</label>
        <input
          value={fiscal.profilo.partitaIva}
          onChange={(e) => fiscal.setProfilo({ partitaIva: e.target.value.replace(/\D/g, "").slice(0, 11) })}
          className="w-full mt-1 p-3 rounded-xl bg-black/40 text-sm"
          inputMode="numeric"
          placeholder="12345678901"
        />
      </div>
      <div>
        <label className="text-[9px] text-white/40">Codice fiscale (opz.)</label>
        <input
          value={fiscal.profilo.codiceFiscale || ""}
          onChange={(e) => fiscal.setProfilo({ codiceFiscale: e.target.value.toUpperCase().slice(0, 16) })}
          className="w-full mt-1 p-3 rounded-xl bg-black/40 text-sm"
        />
      </div>
      <div>
        <label className="text-[9px] text-white/40">Ragione sociale</label>
        <input
          value={fiscal.profilo.ragioneSociale}
          onChange={(e) => fiscal.setProfilo({ ragioneSociale: e.target.value })}
          className="w-full mt-1 p-3 rounded-xl bg-black/40 text-sm"
        />
      </div>
      <div>
        <label className="text-[9px] text-white/40">Indirizzo</label>
        <input
          value={fiscal.profilo.indirizzo}
          onChange={(e) => fiscal.setProfilo({ indirizzo: e.target.value })}
          className="w-full mt-1 p-3 rounded-xl bg-black/40 text-sm"
        />
      </div>
      <div className="grid grid-cols-3 gap-2">
        <div>
          <label className="text-[9px] text-white/40">CAP</label>
          <input
            value={fiscal.profilo.cap}
            onChange={(e) => fiscal.setProfilo({ cap: e.target.value.replace(/\D/g, "").slice(0, 5) })}
            className="w-full mt-1 p-3 rounded-xl bg-black/40 text-sm"
          />
        </div>
        <div>
          <label className="text-[9px] text-white/40">Città</label>
          <input
            value={fiscal.profilo.citta}
            onChange={(e) => fiscal.setProfilo({ citta: e.target.value })}
            className="w-full mt-1 p-3 rounded-xl bg-black/40 text-sm"
          />
        </div>
        <div>
          <label className="text-[9px] text-white/40">Prov.</label>
          <input
            value={fiscal.profilo.provincia}
            onChange={(e) => fiscal.setProfilo({ provincia: e.target.value.toUpperCase().slice(0, 2) })}
            className="w-full mt-1 p-3 rounded-xl bg-black/40 text-sm"
          />
        </div>
      </div>
      <div>
        <label className="text-[9px] text-white/40">Aliquota IVA default</label>
        <div className="flex gap-1.5 mt-1">
          {([22, 10, 4, 0] as AliquotaIva[]).map((a) => (
            <button
              key={a}
              type="button"
              onClick={() => fiscal.setProfilo({ aliquotaDefault: a })}
              className={`flex-1 py-2 rounded-full text-[10px] font-black ${
                fiscal.profilo.aliquotaDefault === a ? "bg-[#FF1A1A] text-black" : "glass"
              }`}
            >
              {a}%
            </button>
          ))}
        </div>
      </div>

      <p className="text-[10px] text-white/50 font-black pt-2">REGISTRATORE TELEMATICO</p>
      {fiscal.rt.hardwareModel && (
        <p className="text-[10px] text-white/35">Hardware: {fiscal.rt.hardwareModel}</p>
      )}
      <label className="flex items-center gap-2 text-[11px] text-white/70">
        <input
          type="checkbox"
          checked={fiscal.rt.enabled}
          onChange={(e) => fiscal.setRt({ enabled: e.target.checked })}
        />
        RT abilitato
      </label>
      <div>
        <label className="text-[9px] text-white/40">Vendor</label>
        <select
          value={fiscal.rt.vendor}
          onChange={(e) => {
            const vendor = e.target.value as RtVendor;
            if (vendor === "3i_xonxoff") {
              fiscal.setRt({
                vendor,
                port: fiscal.rt.port === 80 || fiscal.rt.port === 443 ? 1723 : fiscal.rt.port || 1723,
                hardwareModel: fiscal.rt.hardwareModel || "A8010V",
              });
            } else {
              fiscal.setRt({ vendor });
            }
          }}
          className="w-full mt-1 p-3 rounded-xl bg-black/40 text-sm"
        >
          <option value="epson_fpmate">Epson FpMate</option>
          <option value="3i_xonxoff">3i XonXoff (A8010V / TCP 1723)</option>
          <option value="custom_http">Custom HTTP</option>
          <option value="demo">Demo (non fiscale)</option>
        </select>
      </div>
      <div className="grid grid-cols-[1fr_80px] gap-2">
        <div>
          <label className="text-[9px] text-white/40">IP RT</label>
          <input
            value={fiscal.rt.host}
            onChange={(e) => fiscal.setRt({ host: e.target.value.trim() })}
            className="w-full mt-1 p-3 rounded-xl bg-black/40 text-sm"
            placeholder={fiscal.rt.vendor === "3i_xonxoff" ? "192.168.1.60" : "192.168.1.50"}
          />
        </div>
        <div>
          <label className="text-[9px] text-white/40">Porta</label>
          <input
            type="number"
            value={fiscal.rt.port}
            onChange={(e) => fiscal.setRt({ port: Number(e.target.value) || 80 })}
            className="w-full mt-1 p-3 rounded-xl bg-black/40 text-sm"
          />
        </div>
      </div>
      <label className="flex items-center gap-2 text-[11px] text-white/70">
        <input
          type="checkbox"
          checked={fiscal.rt.useHttps}
          onChange={(e) => fiscal.setRt({ useHttps: e.target.checked, port: e.target.checked ? 443 : fiscal.rt.port === 443 ? 80 : fiscal.rt.port })}
        />
        HTTPS
      </label>
      <div>
        <label className="text-[9px] text-white/40">devid</label>
        <input
          value={fiscal.rt.devid}
          onChange={(e) => fiscal.setRt({ devid: e.target.value })}
          className="w-full mt-1 p-3 rounded-xl bg-black/40 text-sm"
          placeholder="local_printer"
        />
      </div>
      <div>
        <label className="text-[9px] text-white/40">Path CGI</label>
        <input
          value={fiscal.rt.path}
          onChange={(e) => fiscal.setRt({ path: e.target.value })}
          className="w-full mt-1 p-3 rounded-xl bg-black/40 text-sm"
        />
      </div>
      <button
        type="button"
        disabled={testing || !fiscal.rt.host}
        onClick={() => void testRt()}
        className="w-full py-3 rounded-full glass font-black text-sm disabled:opacity-40"
      >
        {testing ? "TEST IN CORSO…" : "TEST CONNESSIONE RT"}
      </button>

      <p className="text-[10px] text-white/50 font-black pt-2">POS</p>
      <label className="flex items-center gap-2 text-[11px] text-white/70">
        <input
          type="checkbox"
          checked={fiscal.pos.enabled}
          onChange={(e) => fiscal.setPos({ enabled: e.target.checked })}
        />
        POS abilitato
      </label>
      <div>
        <label className="text-[9px] text-white/40">Provider</label>
        <select
          value={fiscal.pos.provider}
          onChange={(e) => fiscal.setPos({ provider: e.target.value as PosProvider })}
          className="w-full mt-1 p-3 rounded-xl bg-black/40 text-sm"
        >
          <option value="manual">Manuale</option>
          <option value="sumup">SumUp</option>
          <option value="nexi">Nexi</option>
          <option value="stripe_terminal">Stripe Terminal</option>
        </select>
      </div>
      <div>
        <label className="text-[9px] text-white/40">Terminal ID</label>
        <input
          value={fiscal.pos.terminalId || ""}
          onChange={(e) => fiscal.setPos({ terminalId: e.target.value })}
          className="w-full mt-1 p-3 rounded-xl bg-black/40 text-sm"
        />
      </div>
      <div>
        <label className="text-[9px] text-white/40">Note POS</label>
        <input
          value={fiscal.pos.notes || ""}
          onChange={(e) => fiscal.setPos({ notes: e.target.value })}
          className="w-full mt-1 p-3 rounded-xl bg-black/40 text-sm"
        />
      </div>

      <div className="rounded-2xl border border-amber-500/40 bg-amber-500/10 p-3 space-y-2">
        <p className="text-[11px] font-black text-amber-200">⚠ MODALITÀ DEMO NON FISCALE</p>
        <p className="text-[10px] text-amber-100/80">
          Solo titolare. Se attiva, PAGA E CHIUDI non invia lo scontrino al RT. Vietata in produzione con profilo completo.
          Default: disattivata — con P.IVA + RT abilitato la chiusura fiscale è obbligatoria.
        </p>
        <label className="flex items-center gap-2 text-[11px] text-amber-100">
          <input
            type="checkbox"
            checked={fiscal.demoNonFiscale}
            onChange={(e) => fiscal.setDemoNonFiscale(e.target.checked)}
          />
          Abilita modalità demo non fiscale
        </label>
      </div>

      <div className="rounded-2xl glass p-3 space-y-1">
        <p className="text-[10px] font-black text-white/50">CHECKLIST INSTALLAZIONE LOCALE</p>
        <ol className="text-[10px] text-white/55 list-decimal pl-4 space-y-1">
          <li>Collega il Registratore Telematico alla rete Wi‑Fi/LAN del locale</li>
          <li>Assegna IP fisso al RT (es. 192.168.1.60 per Teste Matte A8010V)</li>
          <li>Epson: FpMate CGI (/cgi-bin/fpmate.cgi). 3i XonXoff: TCP porta 1723</li>
          <li>Inserisci IP/porta qui e premi Test connessione</li>
          <li>Esegui il primo scontrino di prova su un tavolo</li>
        </ol>
        <p className="text-[9px] text-white/35 pt-1">
          Su Vercel il proxy non raggiunge la LAN: apri l&apos;app self-host sulla stessa Wi‑Fi, oppure reverse-proxy locale.
          Il client prova fetch diretto al RT; se CORS fallisce usa /api/fiscal/rt.
        </p>
        {!completo && (
          <p className="text-[10px] text-amber-300 pt-1">Profilo incompleto: inserisci P.IVA e ragione sociale.</p>
        )}
      </div>

      <button type="button" onClick={salva} className="w-full py-3 rounded-full bg-white text-black font-black text-sm">
        SALVA FISCALE
      </button>
      {msg && <p className="text-[11px] text-emerald-300 text-center">{msg}</p>}
    </div>
  );
}
