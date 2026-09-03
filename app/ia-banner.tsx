"use client";

import { useEffect } from "react";
import { useMenteStore } from "@/lib/store";
import { runIaCheck, startIaLoop } from "@/lib/ia-socio";

export default function IaBanner() {
  const avvisi = useMenteStore((s) => s.avvisi);
  useEffect(() => {
    startIaLoop();
  }, []);
  const last = avvisi[0];
  if (!last) {
    return (
      <button
        onClick={() => void runIaCheck()}
        className="fixed top-20 right-3 z-[60] text-[9px] tracking-widest px-3 py-1.5 rounded-full bg-[#FF1A1A] text-black font-black"
      >
        IA CHECK
      </button>
    );
  }
  return (
    <div className="fixed top-20 left-3 right-3 z-[60] max-w-[920px] mx-auto">
      <div className={`rounded-2xl px-4 py-3 text-sm glass-strong ${last.urgente ? "border border-[#FF1A1A]" : ""}`}>
        <div className="flex justify-between gap-3 items-start">
          <p>{last.msg}</p>
          <button onClick={() => void runIaCheck()} className="shrink-0 text-[9px] font-black tracking-widest text-[#FF1A1A]">
            CHECK
          </button>
        </div>
      </div>
    </div>
  );
}
