"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { CheckCircle2, Mail, MousePointerClick } from "lucide-react";
import { cn } from "@/lib/utils";
import type { SceneProps } from "@/features/landing/product-tour/product-tour";
import { ProofPhoto } from "@/features/landing/product-tour/proof-photo";
import { clientNav } from "@/features/landing/product-tour/space-nav";
import { SpaceSidebar } from "@/features/landing/product-tour/space-sidebar";
import { GuideSpot } from "@/features/landing/product-tour/guide-bubble";
import { TOUR_INVOICE, TOUR_ORDER, TOUR_PROOF } from "@/features/landing/product-tour/tour-data";
import { useDelayedCall, useTimeline } from "@/features/landing/product-tour/use-timeline";

const NAV = clientNav("Mes commandes");
/** La preuve s'affiche, puis l'e-mail de facture arrive. */
const ARRIVAL_DURATIONS_MS = [400, 900] as const;
/** Après le clic : le temps de lire la facture et les deux lignes de la bulle, en bas à droite. */
const READING_MS = 5200;

function InvoicePreview() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 240, damping: 26 }}
      className="rounded-2xl bg-white p-3 ring-1 ring-black/[0.06] sm:p-4"
    >
      <div className="flex items-center justify-between">
        <p className="text-sm font-bold">Facture {TOUR_INVOICE.number}</p>
        <span className="rounded-full bg-[#eaf2ff] px-2 py-0.5 text-[10px] font-semibold text-[#1d4f9e]">En attente</span>
      </div>
      <div className="mt-2 flex items-center justify-between border-t border-black/[0.06] pt-2 text-xs">
        <span className="text-muted-foreground">Livraison standard · {TOUR_ORDER.number}</span>
        <span className="font-semibold">{TOUR_INVOICE.amount}</span>
      </div>
      <p className="mt-2 flex items-center gap-1.5 text-[11px] text-muted-foreground">
        <Mail className="h-3.5 w-3.5 text-[#00a854]" aria-hidden />
        Envoyée par e-mail à {TOUR_ORDER.client}
      </p>
    </motion.div>
  );
}

/** ⑥ Espace client : la livraison est confirmée avec sa preuve, la facture arrive par e-mail. */
export function SceneReceipt({ onDone, reducedMotion }: SceneProps) {
  const phase = useTimeline(ARRIVAL_DURATIONS_MS, reducedMotion);
  const [opened, setOpened] = useState(false);
  const mailArrived = phase >= ARRIVAL_DURATIONS_MS.length;
  useDelayedCall(opened, READING_MS, onDone);

  return (
    <div className="flex h-full">
      <SpaceSidebar items={NAV} />
      <div className="relative flex min-w-0 flex-1 flex-col gap-3 px-3 py-3 sm:px-4">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0 leading-tight">
            <p className="truncate text-sm font-semibold">Commande {TOUR_ORDER.number}</p>
            <p className="truncate text-[11px] text-muted-foreground">{TOUR_ORDER.dropoff}</p>
          </div>
          <span className="flex shrink-0 items-center gap-1 rounded-full bg-[#e6f8ee] px-2.5 py-1 text-[11px] font-semibold">
            <CheckCircle2 className="h-3.5 w-3.5 text-[#00a854]" aria-hidden />
            Livrée
          </span>
        </div>

        {phase >= 1 && (
          <div className="product-tour-in flex gap-3 rounded-2xl bg-white p-2.5 ring-1 ring-black/[0.05]">
            <ProofPhoto className="h-[72px] w-[110px] shrink-0 rounded-lg" />
            <div className="min-w-0 leading-tight">
              <p className="text-xs font-semibold">Preuve de livraison</p>
              <p className="mt-1 text-[11px] text-muted-foreground">Remis à {TOUR_PROOF.recipient}</p>
              <p className="text-[11px] text-muted-foreground">Aujourd&apos;hui · {TOUR_PROOF.time}</p>
            </div>
          </div>
        )}

        <AnimatePresence>
          {mailArrived && !opened && (
            <motion.div
              key="mail"
              initial={{ opacity: 0, x: 40 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ type: "spring", stiffness: 260, damping: 26 }}
              className="rounded-2xl bg-[#0e1310] p-3 text-white shadow-[0_16px_40px_rgba(14,19,16,0.25)]"
            >
              <p className="flex items-center gap-2 text-xs font-semibold">
                <Mail className="h-4 w-4 text-[#00d46a]" aria-hidden />
                Nouvel e-mail · Facture {TOUR_INVOICE.number}
              </p>
              <p className="mt-0.5 text-[11px] text-white/70">
                {TOUR_INVOICE.amount} · livraison {TOUR_ORDER.number}
              </p>
              <button
                type="button"
                data-tour-target
                onClick={() => setOpened(true)}
                className="product-tour-pulse mt-2.5 flex min-h-9 max-md:min-h-11 w-full items-center justify-center rounded-xl bg-primary px-3 text-xs font-semibold text-primary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                Voir la facture
              </button>
            </motion.div>
          )}
        </AnimatePresence>
        {opened && <InvoicePreview />}

        <p
          className={cn(
            "mt-auto flex items-center justify-center gap-1 text-[11px] text-muted-foreground transition-opacity duration-300 motion-reduce:transition-none",
            mailArrived && !opened ? "opacity-100" : "opacity-0"
          )}
          aria-hidden
        >
          <MousePointerClick className="h-3 w-3" />
          Cliquez sur « Voir la facture »
        </p>

        {mailArrived && (
          <GuideSpot
            id="receipt"
            corner="br"
            className="bottom-12 right-6"
            lines={["Facture envoyée automatiquement.", ...(opened ? ["Zéro saisie, zéro oubli."] : [])]}
          />
        )}
      </div>
    </div>
  );
}
