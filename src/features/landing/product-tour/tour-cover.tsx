"use client";

import { motion, useIsPresent } from "motion/react";
import { CoverDashboard } from "@/features/landing/product-tour/cover-dashboard";
import { GuideSpot } from "@/features/landing/product-tour/guide-bubble";

const EASE_OUT = [0.22, 1, 0.36, 1] as const;
export const COVER_LABEL = "Livrez votre premier colis";

/**
 * Écran de départ : le tableau de bord entreprise recomposé, légèrement assombri. La bulle-guide s'y pose au centre
 * et devient le bouton de départ ; sur mobile, où la bulle n'existe pas, un bouton au même dessin la remplace.
 */
export function TourCover({ onStart }: { onStart: () => void }) {
  // Dès le clic, l'écran s'efface : son emplacement disparaît et la bulle se rétracte puis part vers la scène.
  const present = useIsPresent();
  return (
    <motion.div
      className="absolute inset-0 z-40 overflow-hidden rounded-[16px] bg-[#0e1310]"
      exit={{ opacity: 0, scale: 1.03, filter: "blur(8px)" }}
      transition={{ duration: 0.5, ease: EASE_OUT }}
    >
      <div className="absolute inset-0">
        <CoverDashboard />
      </div>
      <div
        className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(14,19,16,0.16)_0%,rgba(14,19,16,0.48)_85%)]"
        aria-hidden
      />

      {present && <GuideSpot id="cover" corner="c" action="start" lines={[COVER_LABEL]} className="left-1/2 top-[55%]" />}
      <div className="absolute inset-x-0 top-[55%] flex -translate-y-1/2 justify-center px-6 sm:hidden">
        <button
          type="button"
          data-tour-target
          onClick={onStart}
          className="product-tour-guide product-tour-guide-sheen relative overflow-hidden rounded-[24px] bg-[#2b3530] px-6 py-4 text-lg font-semibold tracking-[-0.01em] leading-snug text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[#2b3530]"
        >
          <span className="product-tour-guide-shine-loop absolute inset-0" aria-hidden />
          <span className="relative">{COVER_LABEL}</span>
        </button>
      </div>
    </motion.div>
  );
}
