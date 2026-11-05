"use client";

import { useState } from "react";
import Link from "next/link";
import { motion } from "motion/react";
import { ArrowRight, BellRing, Check, MousePointerClick, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";
import type { SceneProps } from "@/features/landing/product-tour/product-tour";
import { companyNav } from "@/features/landing/product-tour/space-nav";
import { SpaceSidebar } from "@/features/landing/product-tour/space-sidebar";
import { GuideSpot } from "@/features/landing/product-tour/guide-bubble";
import { TOUR_INVOICE, TOUR_ORDER } from "@/features/landing/product-tour/tour-data";
import { useDelayedCall, useTimeline } from "@/features/landing/product-tour/use-timeline";

const NAV = companyNav("Facturation");
const INTRO_DURATIONS_MS = [600] as const;
/** Laisse voir « Relance envoyée » avant la carte de fin. */
const END_CARD_DELAY_MS = 1600;
/** Durée de lecture du dernier message, sous la carte de fin. */
const FAREWELL_MS = 4000;

type InvoiceRow = { number: string; client: string; amount: string; status: "paid" | "pending" | "late" };

const ROWS: readonly InvoiceRow[] = [
  { number: TOUR_INVOICE.number, client: TOUR_ORDER.client, amount: TOUR_INVOICE.amount, status: "pending" },
  { number: "F-2026-1031", client: "Bureau Bastille", amount: "52,00 €", status: "paid" },
  { number: "F-2026-1027", client: "Studio Oberkampf", amount: "45,00 €", status: "late" },
];

const STATUS = {
  paid: { label: "Payée", className: "bg-[#e6f8ee] text-[#0e1310]" },
  pending: { label: "En attente", className: "bg-[#eaf2ff] text-[#1d4f9e]" },
  late: { label: "En retard · 12 j", className: "bg-[#fde8e6] text-[#a1271b]" },
} as const;

/** ⑦ Espace entreprise : les factures se classent seules, l'impayé se relance en un clic. Fin du parcours. */
export function SceneInvoices({ reducedMotion, onRestart }: SceneProps & { onRestart: () => void }) {
  const intro = useTimeline(INTRO_DURATIONS_MS, reducedMotion);
  const [reminded, setReminded] = useState(false);
  const [finished, setFinished] = useState(false);
  const ready = intro >= INTRO_DURATIONS_MS.length;
  useDelayedCall(reminded, reducedMotion ? 300 : END_CARD_DELAY_MS, () => setFinished(true));
  // Le dernier message reste lisible sous la carte de fin, puis la bulle va se reposer.
  const [resting, setResting] = useState(false);
  useDelayedCall(finished, reducedMotion ? 0 : FAREWELL_MS, () => setResting(true));

  return (
    <div className="relative flex h-full">
      <SpaceSidebar items={NAV} />
      <div className="relative flex min-w-0 flex-1 flex-col gap-3 px-3 py-3 sm:px-4">
        <div className="min-w-0 leading-tight">
          <p className="truncate text-sm font-semibold">Facturation</p>
          <p className="truncate text-[11px] text-muted-foreground">Factures du mois</p>
        </div>

        <ul className="grid grid-cols-3 gap-2" aria-label="Résumé des factures">
          {(["paid", "pending", "late"] as const).map((status) => (
            <li key={status} className="rounded-xl bg-white px-2.5 py-2 ring-1 ring-black/[0.05]">
              <p className="truncate text-[10px] text-muted-foreground">{STATUS[status].label.split(" ·")[0]}</p>
              <p className="text-sm font-bold">1</p>
            </li>
          ))}
        </ul>

        <ul className="space-y-2" aria-label="Factures">
          {ROWS.map((row) => {
            const late = row.status === "late";
            return (
              <li
                key={row.number}
                className={cn(
                  "flex items-center gap-2 rounded-xl bg-white px-2.5 py-2 ring-1 transition-colors duration-300",
                  late && !reminded ? "ring-[#f3b8b1]" : "ring-black/[0.05]"
                )}
              >
                <div className="min-w-0 flex-1 leading-tight">
                  <p className="truncate text-xs font-semibold">{row.number}</p>
                  <p className="truncate text-[11px] text-muted-foreground">{row.client}</p>
                </div>
                <span className="hidden text-xs font-semibold sm:inline">{row.amount}</span>
                <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold", STATUS[row.status].className)}>
                  {STATUS[row.status].label}
                </span>
                {late &&
                  (reminded ? (
                    <span className="flex shrink-0 items-center gap-1 rounded-lg bg-[#e6f8ee] px-2 py-1.5 text-[11px] font-semibold">
                      <Check className="h-3 w-3 text-[#00a854]" strokeWidth={3} aria-hidden />
                      Relance envoyée
                    </span>
                  ) : (
                    <button
                      type="button"
                      data-tour-target
                      disabled={!ready}
                      onClick={() => setReminded(true)}
                      className={cn(
                        "flex shrink-0 items-center gap-1 rounded-lg bg-primary px-2 py-1.5 text-[11px] font-semibold text-primary-foreground transition-opacity duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 motion-reduce:transition-none",
                        ready ? "product-tour-pulse" : "opacity-40"
                      )}
                    >
                      <BellRing className="h-3 w-3" aria-hidden />
                      Relancer
                    </button>
                  ))}
              </li>
            );
          })}
        </ul>

        <p
          className={cn(
            "mt-auto flex items-center justify-center gap-1 text-[11px] text-muted-foreground transition-opacity duration-300 motion-reduce:transition-none",
            ready && !reminded ? "opacity-100" : "opacity-0"
          )}
          aria-hidden
        >
          <MousePointerClick className="h-3 w-3" />
          Cliquez sur « Relancer »
        </p>

        {/* Après la relance, la bulle attend en goutte : son dernier message s'affiche une seule fois, sous la carte de fin. */}
        {ready && !reminded && (
          <GuideSpot
            id="invoices"
            corner="bl"
            className="bottom-14 left-6"
            lines={["Payées, en attente, en retard : tout est trié.", { text: "Impayés repérés. Relance en un clic.", delay: 1 }]}
          />
        )}
      </div>

      {finished && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4 }}
          className="absolute inset-0 z-30 flex items-center justify-center bg-[#f5f8f6]/80 p-6 backdrop-blur-sm"
        >
          {/* Fin du parcours : la bulle se referme et repart doucement se poser en goutte en bas à droite. */}
          {resting && <GuideSpot id="end" lines={[]} slow className="bottom-5 right-5" />}
          <motion.div
            initial={{ y: 16, scale: 0.97 }}
            animate={{ y: 0, scale: 1 }}
            transition={{ type: "spring", stiffness: 240, damping: 24 }}
            className="relative w-full max-w-sm rounded-2xl bg-white p-5 text-center shadow-[0_24px_60px_rgba(14,19,16,0.18)]"
          >
            {!resting && (
              <GuideSpot id="farewell" corner="c" lines={["Relance partie. Rien à écrire."]} className="left-1/2 top-[calc(100%+32px)]" />
            )}
            <p className="text-lg font-bold tracking-[-0.02em]">De la commande au paiement.</p>
            <p className="mt-1 text-sm text-muted-foreground">Une seule plateforme, sans tableur.</p>
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={onRestart}
                className="inline-flex min-h-10 max-md:min-h-11 items-center justify-center gap-1.5 rounded-xl border border-border bg-white px-3 text-xs font-semibold transition-colors hover:bg-[#f0f4f1] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <RotateCcw className="h-3.5 w-3.5" aria-hidden />
                Rejouer
              </button>
              <Link
                href="/contact"
                className="inline-flex min-h-10 max-md:min-h-11 flex-1 items-center justify-center gap-1.5 rounded-xl bg-[#0e1310] px-3 text-xs font-semibold text-white transition-colors hover:bg-[#232a26] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                Demander un pilote
                <ArrowRight className="h-3.5 w-3.5" aria-hidden />
              </Link>
            </div>
          </motion.div>
        </motion.div>
      )}
    </div>
  );
}
