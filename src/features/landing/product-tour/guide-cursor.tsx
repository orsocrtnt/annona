"use client";

import { useEffect, useState, type RefObject } from "react";
import { AnimatePresence, motion } from "motion/react";

type Target = { x: number; y: number };

/** Intervalle de recherche du geste attendu : les scènes l'affichent après leurs animations. */
const LOOKUP_MS = 250;

function findTarget(stage: HTMLElement): Target | null {
  const element = stage.querySelector<HTMLButtonElement>("[data-tour-target]:not(:disabled)");
  if (!element) return null;
  const box = element.getBoundingClientRect();
  const frame = stage.getBoundingClientRect();
  if (box.width === 0) return null;
  // Pointe de la flèche un peu à droite du centre, comme une vraie main sur la souris.
  return { x: box.left - frame.left + box.width * 0.62, y: box.top - frame.top + box.height * 0.6 };
}

/** Curseur qui rejoint le bouton à cliquer et mime un clic, sans jamais intercepter la souris. */
export function GuideCursor({ stage, hidden }: { stage: RefObject<HTMLDivElement | null>; hidden: boolean }) {
  const [target, setTarget] = useState<Target | null>(null);

  useEffect(() => {
    if (hidden) return;
    const timer = setInterval(() => {
      const element = stage.current;
      const next = element ? findTarget(element) : null;
      setTarget((previous) =>
        previous && next && Math.abs(previous.x - next.x) < 1 && Math.abs(previous.y - next.y) < 1 ? previous : next
      );
    }, LOOKUP_MS);
    return () => clearInterval(timer);
  }, [stage, hidden]);

  const visible = !hidden && target !== null;

  return (
    <AnimatePresence>
      {visible && target && (
        <motion.div
          key="guide-cursor"
          className="pointer-events-none absolute left-0 top-0 z-30"
          initial={{ opacity: 0, x: target.x + 70, y: target.y + 60 }}
          animate={{ opacity: 1, x: target.x, y: target.y }}
          exit={{ opacity: 0, transition: { duration: 0.2 } }}
          transition={{ type: "spring", stiffness: 70, damping: 16, mass: 1 }}
          aria-hidden
        >
          <span className="product-tour-cursor-ripple absolute -left-4 -top-4 h-8 w-8 rounded-full border-2 border-[#00d46a]" />
          <svg width="26" height="30" viewBox="0 0 26 30" className="product-tour-cursor-tap relative drop-shadow-[0_4px_8px_rgba(14,19,16,0.35)]">
            <path
              d="M2 2 L2 23 L7.5 17.8 L11.2 26.5 L15 24.9 L11.4 16.4 L19 16.4 Z"
              fill="#0e1310"
              stroke="#ffffff"
              strokeWidth="1.8"
              strokeLinejoin="round"
            />
          </svg>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
