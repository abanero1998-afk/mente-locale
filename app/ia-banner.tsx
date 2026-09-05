"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useMenteStore } from "@/lib/store";
import { emitIaNav, replyIaChat, startIaLoop } from "@/lib/ia-socio";
import type { IaAzione, IaAzioneKind } from "@/lib/types";

type ChatRow = {
  id: string;
  role: "bot" | "user";
  text: string;
  ts: number;
  azioni?: IaAzione[];
  urgente?: boolean;
};

function kindLabel(kind: IaAzioneKind) {
  switch (kind) {
    case "magazzino":
      return "Magazzino";
    case "haccp":
      return "HACCP";
    case "kds":
      return "KDS";
    case "prenotazioni":
      return "Prenotazioni";
    case "tavolo":
      return "Tavoli";
    case "cassa":
      return "Cassa";
    case "menu":
      return "Menu";
    default:
      return kind;
  }
}

export default function IaBanner() {
  const avvisi = useMenteStore((s) => s.avvisi);
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [extra, setExtra] = useState<ChatRow[]>([]);
  const listRef = useRef<HTMLDivElement>(null);
  const seenIds = useRef<Record<string, true>>({});

  useEffect(() => {
    startIaLoop();
  }, []);

  const unread = useMemo(() => avvisi.filter((a) => !a.letto).length, [avvisi]);

  const messages: ChatRow[] = useMemo(() => {
    const fromAvvisi: ChatRow[] = avvisi
      .slice()
      .reverse()
      .map((a) => ({
        id: a.id,
        role: "bot" as const,
        text: a.msg,
        ts: a.ts,
        azioni: a.azioni,
        urgente: a.urgente,
      }));
    const merged = [...fromAvvisi, ...extra].sort((a, b) => a.ts - b.ts);
    return merged.slice(-60);
  }, [avvisi, extra]);

  useEffect(() => {
    if (!open) return;
    useMenteStore.getState().markAvvisiLetti();
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [open, messages.length]);

  useEffect(() => {
    // badge pulse when new avviso arrives while closed
    for (const a of avvisi) {
      if (!seenIds.current[a.id]) seenIds.current[a.id] = true;
    }
  }, [avvisi]);

  const onAction = (a: IaAzione) => {
    emitIaNav(a.kind);
    setOpen(false);
  };

  const send = async () => {
    const text = input.trim();
    if (!text || busy) return;
    setInput("");
    const userRow: ChatRow = {
      id: `u-${Date.now()}`,
      role: "user",
      text,
      ts: Date.now(),
    };
    setExtra((rows) => [...rows, userRow]);
    setBusy(true);
    try {
      const reply = await replyIaChat(text);
      setExtra((rows) => [
        ...rows,
        {
          id: `b-${Date.now()}`,
          role: "bot",
          text: reply.msg,
          ts: Date.now() + 1,
          azioni: reply.azioni,
        },
      ]);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <style>{`
        .ml-ia-glass{backdrop-filter:blur(40px);background:rgba(255,255,255,.04);border:.5px solid rgba(255,26,26,.12)}
        .ml-ia-glass-strong{backdrop-filter:blur(60px);background:rgba(8,8,12,.88);border:.5px solid rgba(255,26,26,.18)}
      `}</style>

      {/* Floating bubble — sopra la nav (~bottom-24) */}
      {!open && (
        <button
          type="button"
          aria-label="Apri IA Socio"
          onClick={() => setOpen(true)}
          className="fixed right-4 z-[60] w-14 h-14 rounded-full ml-ia-glass-strong shadow-lg flex items-center justify-center border border-[#FF1A1A]/40"
          style={{ bottom: "5.5rem" }}
        >
          <span className="text-lg font-black text-[#FF2A2A]">IA</span>
          {unread > 0 && (
            <span className="absolute -top-1 -right-1 min-w-[20px] h-5 px-1 rounded-full bg-[#FF1A1A] text-black text-[10px] font-black flex items-center justify-center">
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </button>
      )}

      {open && (
        <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/55 p-3 pb-[5.25rem]">
          <div className="w-full max-w-[560px] max-h-[72vh] rounded-[28px] ml-ia-glass-strong flex flex-col overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
              <div>
                <p className="font-black tracking-widest text-sm text-[#FF2A2A]">IA SOCIO</p>
                <p className="text-[10px] text-white/40">Regole locali · azioni rapide</p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="text-white/50 text-xs font-bold px-3 py-1 rounded-full ml-ia-glass"
              >
                Chiudi
              </button>
            </div>

            <div ref={listRef} className="flex-1 overflow-y-auto px-3 py-3 space-y-2 min-h-[220px]">
              {messages.length === 0 && (
                <p className="text-[12px] text-white/40 text-center py-8">
                  Nessun avviso. Chiedi: «come va la cassa?», «frighi?», «cosa fare ora?»
                </p>
              )}
              {messages.map((m) => (
                <div
                  key={m.id}
                  className={`max-w-[92%] rounded-2xl px-3 py-2 text-[13px] whitespace-pre-wrap ${
                    m.role === "user"
                      ? "ml-auto bg-[#FF1A1A]/20 border border-[#FF1A1A]/25"
                      : m.urgente
                        ? "mr-auto ml-ia-glass border border-amber-400/40"
                        : "mr-auto ml-ia-glass"
                  }`}
                >
                  <p className="text-[9px] uppercase tracking-widest text-white/35 mb-1">
                    {m.role === "user" ? "Tu" : "IA Socio"}
                  </p>
                  <p>{m.text}</p>
                  {m.azioni && m.azioni.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {m.azioni.map((a) => (
                        <button
                          key={a.id}
                          type="button"
                          onClick={() => onAction(a)}
                          className="px-2.5 py-1 rounded-full text-[10px] font-black bg-white text-black"
                        >
                          {a.label || kindLabel(a.kind)}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div className="p-3 border-t border-white/10 flex gap-2">
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void send();
                }}
                placeholder="Scrivi a IA Socio…"
                className="flex-1 rounded-2xl ml-ia-glass px-4 py-3 bg-transparent outline-none text-sm"
              />
              <button
                type="button"
                disabled={busy || !input.trim()}
                onClick={() => void send()}
                className="px-4 rounded-2xl bg-[#FF1A1A] text-black font-black text-sm disabled:opacity-40"
              >
                {busy ? "…" : "Invia"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
