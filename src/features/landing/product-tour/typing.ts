"use client";

import { useEffect, useState } from "react";

const BASE_DELAY_MS = 32;
const JITTER_MS = 16;
/** Pause plus longue au début d'un mot, comme quelqu'un qui tape vraiment. */
const WORD_PAUSE_MS = 40;
/** Pause avant de commencer à remplir chaque champ. */
const FIELD_PAUSE_MS = 300;

/** Délai (ms) avant chaque caractère : 32–48 ms, +40 ms après un espace ou une ponctuation. Déterministe. */
export function typingDelays(text: string, seed = 1): number[] {
  let state = seed >>> 0 || 1;
  const random = () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 2 ** 32;
  };
  return [...text].map((_, index) => {
    const previous = index > 0 ? text[index - 1] : "";
    const pause = previous && /[\s,·–]/.test(previous) ? WORD_PAUSE_MS : 0;
    return BASE_DELAY_MS + Math.round(random() * JITTER_MS) + pause;
  });
}

export type Typewriter = { typed: string[]; activeField: number; done: boolean };

/** Remplit les champs l'un après l'autre, lettre par lettre, une fois `active` vrai. */
export function useTypewriter(texts: readonly string[], active: boolean, reducedMotion: boolean): Typewriter {
  const [progress, setProgress] = useState({ field: -1, chars: 0 });
  const key = texts.join("\u0000");

  useEffect(() => {
    if (!active || reducedMotion) return;
    const fields = key.split("\u0000");
    const timers: ReturnType<typeof setTimeout>[] = [];
    let at = 0;
    fields.forEach((text, field) => {
      at += FIELD_PAUSE_MS;
      timers.push(setTimeout(() => setProgress({ field, chars: 0 }), at));
      typingDelays(text, field + 1).forEach((delay, index) => {
        at += delay;
        timers.push(setTimeout(() => setProgress({ field, chars: index + 1 }), at));
      });
    });
    at += FIELD_PAUSE_MS / 2;
    timers.push(setTimeout(() => setProgress({ field: fields.length, chars: 0 }), at));
    return () => timers.forEach(clearTimeout);
  }, [key, active, reducedMotion]);

  if (active && reducedMotion) return { typed: [...texts], activeField: texts.length, done: true };
  const typed = texts.map((text, field) =>
    field < progress.field ? text : field === progress.field ? text.slice(0, progress.chars) : ""
  );
  return { typed, activeField: progress.field, done: progress.field >= texts.length };
}
