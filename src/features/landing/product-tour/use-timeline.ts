"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";

/** Pause entre le résultat d'un geste et le passage à la scène suivante. */
export const GESTURE_RESULT_DELAY_MS = 900;

const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

function subscribeReducedMotion(onChange: () => void) {
  const query = window.matchMedia(REDUCED_MOTION_QUERY);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

export function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(
    subscribeReducedMotion,
    () => window.matchMedia(REDUCED_MOTION_QUERY).matches,
    () => false
  );
}

/**
 * Phase courante d'une scène (0 … durationsMs.length) : chaque phase avance après sa durée.
 * En mouvement réduit, la scène saute directement à sa dernière phase.
 */
export function useTimeline(durationsMs: readonly number[], reducedMotion: boolean): number {
  const [elapsed, setElapsed] = useState(0);
  const key = durationsMs.join(",");

  useEffect(() => {
    if (reducedMotion || !key) return;
    const timers: ReturnType<typeof setTimeout>[] = [];
    let at = 0;
    key.split(",").forEach((duration, index) => {
      at += Number(duration);
      timers.push(setTimeout(() => setElapsed(index + 1), at));
    });
    return () => timers.forEach(clearTimeout);
  }, [key, reducedMotion]);

  return reducedMotion ? durationsMs.length : elapsed;
}

/** Appelle `callback` une fois, `delayMs` après que `active` est devenu vrai ; annulé au démontage. */
export function useDelayedCall(active: boolean, delayMs: number, callback: () => void) {
  const latest = useRef(callback);

  useEffect(() => {
    latest.current = callback;
  });

  useEffect(() => {
    if (!active) return;
    const timer = setTimeout(() => latest.current(), delayMs);
    return () => clearTimeout(timer);
  }, [active, delayMs]);
}
