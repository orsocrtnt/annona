"use client";

import { useEffect } from "react";

const HEARTBEAT_MS = 60_000;

/** Pendant une démo, signale chaque minute que l'onglet est ouvert et visible (compteur « en direct » du super admin). */
export function useDemoHeartbeat(active: boolean) {
  useEffect(() => {
    if (!active) return;
    const beat = () => {
      if (document.visibilityState !== "visible") return;
      void fetch("/api/demo/heartbeat", { method: "POST", keepalive: true }).catch(() => {});
    };
    beat();
    const timer = window.setInterval(beat, HEARTBEAT_MS);
    document.addEventListener("visibilitychange", beat);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", beat);
    };
  }, [active]);
}
