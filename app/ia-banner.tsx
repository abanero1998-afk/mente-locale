"use client";

import { useEffect } from "react";
import { startIaLoop } from "@/lib/ia-socio";

/** Solo notifiche: niente overlay CHECK. Il loop IA resta attivo. */
export default function IaBanner() {
  useEffect(() => {
    startIaLoop();
  }, []);
  return null;
}
