"use client";

import { useState } from "react";
import { motion } from "motion/react";
import { BarChart3, Check, LayoutDashboard, MapPin, MousePointerClick, Package, Radio, Receipt, Sparkles, Truck, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { SceneProps } from "@/features/landing/product-tour/product-tour";
import { SpaceSidebar, type SpaceNavItem } from "@/features/landing/product-tour/space-sidebar";
import { TOUR_DISPATCH_REASON, TOUR_DRIVERS, TOUR_ORDER } from "@/features/landing/product-tour/tour-data";
import {
  GESTURE_RESULT_DELAY_MS,
  useDelayedCall,
  useTimeline,
} from "@/features/landing/product-tour/use-timeline";

const ARRIVAL_DURATIONS_MS = [400, 550] as const;
/** Un livreur examiné par intervalle, puis l'attribution. */
const EXAMINE_DURATIONS_MS = [520, 520, 520, 400] as const;
const NOT_LAUNCHED: readonly number[] = [];
/** Laisse voir la carte glisser et passer au bleu avant le carton suivant. */
const ASSIGNED_VIEW_MS = GESTURE_RESULT_DELAY_MS + 700;

const NAV: readonly SpaceNavItem[] = [
  { icon: LayoutDashboard, label: "Tableau de bord" },
  { icon: Package, label: "Commandes" },
  { icon: Radio, label: "Dispatch", active: true },
  { icon: Truck, label: "Chauffeurs" },
  { icon: BarChart3, label: "Analyse" },
  { icon: Receipt, label: "Facturation" },
];

function OrderCard({ assigned }: { assigned: boolean }) {
  return (
    <motion.div
      layoutId="product-tour-order-1042"
      initial={{ opacity: 0, y: -14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 260, damping: 28 }}
      className={cn(
        "rounded-xl border p-2.5 text-left transition-colors duration-500 motion-reduce:transition-none",
        assigned ? "border-[#cfe0fb] bg-[#f3f7ff]" : "border-[#f3dcae] bg-[#fff8ec]"
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-bold">{TOUR_ORDER.number}</p>
        <span
          className={cn(
            "shrink-0 whitespace-nowrap rounded-full px-1.5 py-0.5 text-[10px] font-semibold",
            assigned ? "bg-[#dde9fd] text-[#1d4f9e]" : "bg-[#fdeccb] text-[#8a5a00]"
          )}
        >
          {assigned ? "Karim" : "À attribuer"}
        </span>
      </div>
      <p className="mt-1 truncate text-[11px] text-muted-foreground">{TOUR_ORDER.client}</p>
      <p className="truncate text-[11px] text-muted-foreground">Roquette, 11e · {TOUR_ORDER.slot}</p>
    </motion.div>
  );
}

function Column({ title, tone, children }: { title: string; tone: "amber" | "blue"; children?: React.ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col rounded-2xl bg-white p-2.5 ring-1 ring-black/[0.05]">
      <p className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold text-muted-foreground">
        <span className={cn("h-2 w-2 rounded-full", tone === "amber" ? "bg-[#f0a92e]" : "bg-[#3b82f6]")} aria-hidden />
        {title}
      </p>
      <div className="flex min-h-[74px] flex-1 flex-col gap-2">{children}</div>
    </div>
  );
}

function DriverReview({ phase, assigned }: { phase: number; assigned: boolean }) {
  return (
    <>
      <ul className="space-y-1.5" aria-label="Livreurs examinés par le dispatcher">
        {TOUR_DRIVERS.map((driver, index) => {
          const examined = phase > index;
          const chosen = examined && driver.verdict === "chosen";
          return (
            <li
              key={driver.name}
              className={cn(
                "flex items-center gap-2.5 rounded-xl px-2.5 py-1.5 transition-colors motion-reduce:transition-none",
                chosen ? "bg-[#e6f8ee] ring-1 ring-[#00d46a]/40" : "bg-[#f5f8f6]"
              )}
            >
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#0e1310] text-[10px] font-bold text-white" aria-hidden>
                {driver.name[0]}
              </span>
              <div className="min-w-0 flex-1 leading-tight">
                <p className="text-xs font-semibold">{driver.name}</p>
                <p className="truncate text-[11px] text-muted-foreground">
                  {examined ? driver.reason : driver.status}
                </p>
              </div>
              {!examined ? (
                <span className="h-2 w-2 animate-pulse rounded-full bg-[#c9d3cd] motion-reduce:animate-none" aria-label="En cours d'examen" />
              ) : driver.verdict === "chosen" ? (
                <Check className="product-tour-in h-4 w-4 text-[#00a854]" strokeWidth={3} aria-label="Retenu" />
              ) : (
                <X className="product-tour-in h-4 w-4 text-muted-foreground" aria-label="Écarté" />
              )}
            </li>
          );
        })}
      </ul>
      <p
        className={cn(
          "mt-2 text-center text-xs font-semibold transition-opacity motion-reduce:transition-none",
          assigned ? "opacity-100" : "opacity-0"
        )}
      >
        Retenu : Karim · {TOUR_DISPATCH_REASON}
      </p>
    </>
  );
}

/** ② Espace entreprise : #1042 arrive sans livreur, le visiteur lance le dispatcher intelligent. */
export function SceneDispatch({ onDone, reducedMotion }: SceneProps) {
  const phase = useTimeline(ARRIVAL_DURATIONS_MS, reducedMotion);
  const [launched, setLaunched] = useState(false);
  const examined = useTimeline(launched ? EXAMINE_DURATIONS_MS : NOT_LAUNCHED, reducedMotion);
  const assigned = launched && examined > TOUR_DRIVERS.length;
  const ready = phase >= ARRIVAL_DURATIONS_MS.length;
  useDelayedCall(assigned, ASSIGNED_VIEW_MS, onDone);

  return (
    <div className="flex h-full">
      <SpaceSidebar items={NAV} />
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-3 sm:flex-nowrap sm:px-4">
          <div className="min-w-0 leading-tight">
            <p className="truncate text-sm font-semibold">Dispatch</p>
            <p className="truncate text-[11px] text-muted-foreground">File d&apos;attente du jour</p>
          </div>
          <div className="flex w-full items-center justify-end gap-1.5 sm:w-auto sm:shrink-0">
            <span title="Carte livraison" className="hidden h-8 w-8 items-center justify-center rounded-lg border border-border bg-white text-muted-foreground sm:flex" aria-hidden>
              <MapPin className="h-3.5 w-3.5" />
            </span>
            <span title="Carte chauffeurs" className="hidden h-8 w-8 items-center justify-center rounded-lg border border-border bg-white text-muted-foreground sm:flex" aria-hidden>
              <Truck className="h-3.5 w-3.5" />
            </span>
            <button
              type="button"
              data-tour-target
              disabled={!ready || launched}
              onClick={() => setLaunched(true)}
              className={cn(
                "flex min-h-8 flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg bg-primary px-2.5 text-[11px] font-semibold sm:flex-none text-primary-foreground transition-opacity duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 motion-reduce:transition-none",
                ready && !launched ? "product-tour-pulse" : !ready && "opacity-40"
              )}
            >
              <Sparkles className="h-3.5 w-3.5 shrink-0" aria-hidden />
              Lancer le dispatcher intelligent
            </button>
          </div>
        </div>

        <div className="flex flex-1 flex-col gap-3 px-3 pb-3 sm:px-4 sm:pb-4">
          <div className="grid min-h-0 flex-1 grid-cols-2 gap-2.5">
            <Column title="Sans livreur" tone="amber">
              {phase >= 1 && !assigned && <OrderCard assigned={false} />}
            </Column>
            <Column title="À démarrer" tone="blue">
              {assigned && <OrderCard assigned />}
              <div className="hidden rounded-xl border border-[#cfe0fb] bg-[#f3f7ff] p-2.5 sm:block" aria-hidden>
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-bold">#1039</p>
                  <span className="shrink-0 rounded-full bg-[#dde9fd] px-1.5 py-0.5 text-[10px] font-semibold text-[#1d4f9e]">Lucas</span>
                </div>
                <p className="mt-1 truncate text-[11px] text-muted-foreground">Bureau Bastille</p>
                <p className="truncate text-[11px] text-muted-foreground">Bastille, 4e · 11 h – 13 h</p>
              </div>
            </Column>
          </div>

          <div className="mt-auto rounded-2xl bg-white p-3 ring-1 ring-black/[0.05]">
            {launched ? (
              <DriverReview phase={examined} assigned={assigned} />
            ) : (
              <div className="flex h-full flex-col justify-center gap-2 py-2 text-center">
                <p className="text-xs text-muted-foreground">
                  Le dispatcher choisit le livreur selon sa disponibilité, sa zone et sa charge.
                </p>
                <p
                  className={cn(
                    "mx-auto flex items-center gap-1 rounded-lg bg-[#0e1310] px-2 py-1 text-[11px] font-semibold text-white shadow-lg transition-opacity duration-300 motion-reduce:transition-none",
                    ready ? "opacity-100" : "opacity-0"
                  )}
                  aria-hidden={!ready}
                >
                  <MousePointerClick className="h-3 w-3" aria-hidden />
                  Cliquez sur « Lancer le dispatcher intelligent » en haut
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
