"use client";

import { useState } from "react";
import { LayoutGroup, motion } from "motion/react";
import { ArrowRight, Check, Layers, MapPin, MousePointerClick, Sparkles, Timer, Truck } from "lucide-react";
import { cn } from "@/lib/utils";
import type { SceneProps } from "@/features/landing/product-tour/product-tour";
import { companyNav } from "@/features/landing/product-tour/space-nav";
import { SpaceSidebar } from "@/features/landing/product-tour/space-sidebar";
import { GuideSpot } from "@/features/landing/product-tour/guide-bubble";
import { TOUR_LANES, TOUR_QUEUE, type TourQueuedOrder } from "@/features/landing/product-tour/tour-data";
import {
  DISPATCH_STEP_LABELS,
  dispatchPhase,
  dispatchStepIndex,
  type DispatchPhase,
} from "@/features/landing/product-tour/tour-machine";
import { useDelayedCall, useTimeline } from "@/features/landing/product-tour/use-timeline";

const NAV = companyNav("Dispatch");
/** La file arrive, puis le bouton s'active une fois les bulles « Avant » lues. */
const ARRIVAL_DURATIONS_MS = [400, 550, 1300] as const;
/** Critères analysés par le dispatcher, cochés un à un avant la répartition. */
const CRITERIA = ["Position GPS", "Disponibilité", "Charge", "Trajets"] as const;
/** Un critère coché, puis une commande déposée chez son livreur, à chaque intervalle. */
const DISPATCH_DURATIONS_MS = [...CRITERIA.map(() => 450), ...TOUR_QUEUE.map(() => 600)] as const;
const NOT_LAUNCHED: readonly number[] = [];
const GROUPED_ORDERS = TOUR_QUEUE.filter((order) => order.grouped).map((order) => order.number);
/** Nombre de commandes posées à partir duquel la tournée groupée est visible. */
const GROUPED_VISIBLE_AT = TOUR_QUEUE.map((order) => order.grouped).lastIndexOf(true) + 1;
/** Laisse lire les bulles « Après » avant d'afficher « Passer à la suite ». */
const CONTINUE_DELAY_MS = [1400] as const;

/** Bulles de chaque sous-étape, avec leur délai d'apparition en secondes. */
const PHASE_BUBBLES: Record<DispatchPhase, readonly { text: string; delay: number }[]> = {
  before: [
    { text: `${TOUR_QUEUE.length} commandes, ${TOUR_LANES.length} livreurs.`, delay: 0.3 },
    { text: "À la main : appels, tableur, oublis.", delay: 1.1 },
    { text: "Ici, un seul clic.", delay: 1.9 },
  ],
  during: [{ text: "Il croise GPS, charge et trajets.", delay: 0.2 }],
  after: [
    { text: "Fini le dispatch à la main.", delay: 0.2 },
    { text: "Chaque livreur a sa tournée.", delay: 0.9 },
  ],
};

function OrderChip({ order, placed }: { order: TourQueuedOrder; placed: boolean }) {
  return (
    <motion.div
      layout
      layoutId={`tour-order-${order.number}`}
      transition={{ type: "spring", stiffness: 260, damping: 28 }}
      className={cn(
        "rounded-lg border px-2 py-1.5 text-left transition-colors duration-500 motion-reduce:transition-none",
        placed ? "border-[#cfe0fb] bg-[#f3f7ff]" : "border-[#f3dcae] bg-[#fff8ec]"
      )}
    >
      <p className="text-[11px] font-bold leading-tight">{order.number}</p>
      <p className="truncate text-[10px] text-muted-foreground">{order.place}</p>
    </motion.div>
  );
}

/** Avant · Après : où en est le dispatch. */
function PhaseSteps({ phase }: { phase: DispatchPhase }) {
  const current = dispatchStepIndex(phase);
  return (
    <ol className="hidden grid-cols-2 gap-1 rounded-xl bg-white p-1 ring-1 ring-black/[0.05] sm:grid" aria-label="Étapes du dispatch">
      {DISPATCH_STEP_LABELS.map((label, index) => (
        <li
          key={label}
          aria-current={index === current ? "step" : undefined}
          className={cn(
            "relative flex items-center justify-center gap-1 rounded-lg py-1 text-[10px] font-semibold transition-colors duration-300",
            index === current ? "text-white" : index < current ? "text-[#0e1310]" : "text-muted-foreground"
          )}
        >
          {index === current && (
            <motion.span layoutId="dispatch-phase" className="absolute inset-0 rounded-lg bg-[#0e1310]" transition={{ type: "spring", stiffness: 320, damping: 30 }} />
          )}
          <span className="relative flex items-center gap-1">
            {index < current && <Check className="h-2.5 w-2.5 text-[#00a854]" strokeWidth={3} aria-hidden />}
            {label}
          </span>
        </li>
      ))}
    </ol>
  );
}

/**
 * ② Espace entreprise, en trois temps : 4 commandes attendent (avant), le dispatcher analyse puis les
 * répartit entre les livreurs (pendant), la tournée de chacun est prête (après). Le visiteur passe à la suite lui-même.
 */
export function SceneDispatch({ onDone, reducedMotion }: SceneProps) {
  const arrival = useTimeline(ARRIVAL_DURATIONS_MS, reducedMotion);
  const [launchedAt, setLaunchedAt] = useState<number | null>(null);
  const [decidedInMs, setDecidedInMs] = useState<number | null>(null);
  const launched = launchedAt !== null;
  const progress = useTimeline(launched ? DISPATCH_DURATIONS_MS : NOT_LAUNCHED, reducedMotion);
  const checked = Math.min(progress, CRITERIA.length);
  const placedCount = Math.max(0, progress - CRITERIA.length);
  const phase = dispatchPhase(launched, placedCount, TOUR_QUEUE.length);
  const ready = arrival >= ARRIVAL_DURATIONS_MS.length;
  const canContinue = useTimeline(phase === "after" ? CONTINUE_DELAY_MS : NOT_LAUNCHED, reducedMotion) >= 1;

  const placed = new Set(TOUR_QUEUE.slice(0, placedCount).map((order) => order.number));
  const waiting = TOUR_QUEUE.filter((order) => !placed.has(order.number));
  // Sous « Après », les bulles de la répartition restent et celles du résultat s'ajoutent dessous.
  const bubbles =
    phase === "before"
      ? PHASE_BUBBLES.before
      : [
          ...PHASE_BUBBLES.during,
          ...(placedCount >= GROUPED_VISIBLE_AT ? [{ text: `${GROUPED_ORDERS.join(" et ")} voisines : même tournée.`, delay: 0.1 }] : []),
          ...(phase === "after" ? PHASE_BUBBLES.after : []),
        ];
  // Chrono réel de la répartition dans la démo, du clic à la dernière commande déposée.
  useDelayedCall(phase === "after", 0, () => setDecidedInMs(launchedAt === null ? null : performance.now() - launchedAt));

  return (
    <div className="flex h-full">
      <SpaceSidebar items={NAV} />
      <div className="relative flex min-w-0 flex-1 flex-col">
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
              onClick={() => setLaunchedAt(performance.now())}
              className={cn(
                "flex min-h-8 max-md:min-h-11 flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg bg-primary px-2.5 text-[11px] font-semibold text-primary-foreground transition-opacity duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 motion-reduce:transition-none sm:flex-none",
                ready && !launched ? "product-tour-pulse" : !ready && "opacity-40"
              )}
            >
              {phase === "after" ? <Check className="h-3.5 w-3.5 shrink-0" strokeWidth={3} aria-hidden /> : <Sparkles className="h-3.5 w-3.5 shrink-0" aria-hidden />}
              {phase === "before" ? "Lancer le dispatcher intelligent" : phase === "during" ? "Répartition en cours…" : "Dispatch terminé"}
            </button>
          </div>
        </div>

        <div className="flex min-h-0 flex-1 flex-col gap-2.5 px-3 pb-3 sm:flex-row sm:px-4 sm:pb-4">
          <LayoutGroup>
            <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-2.5">
              <section aria-label="Commandes en attente" className="rounded-2xl bg-white p-2.5 ring-1 ring-black/[0.05]">
                <p className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold text-muted-foreground">
                  <span className="h-2 w-2 rounded-full bg-[#f0a92e]" aria-hidden />
                  Sans livreur · {waiting.length}
                </p>
                <div className="grid min-h-[44px] grid-cols-2 gap-1.5 sm:grid-cols-4">
                  {arrival >= 1 && waiting.map((order) => <OrderChip key={order.number} order={order} placed={false} />)}
                  {phase === "after" && (
                    <p className="col-span-full flex items-center justify-center gap-1 text-[11px] font-semibold text-[#00a854]">
                      <Check className="h-3.5 w-3.5" strokeWidth={3} aria-hidden />
                      Tout est réparti
                    </p>
                  )}
                </div>
              </section>

              <div className="flex min-h-6 flex-wrap items-center justify-center gap-1.5" aria-live="polite">
                {phase === "after" && decidedInMs !== null ? (
                  <span className="flex items-center gap-1 rounded-full bg-[#0e1310] px-2.5 py-1 text-[11px] font-semibold text-white">
                    <Timer className="h-3 w-3 text-[#00d46a]" aria-hidden />
                    Réparti en {(decidedInMs / 1000).toLocaleString("fr-FR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} s
                  </span>
                ) : launched ? (
                  CRITERIA.map((criterion, index) => (
                    <span
                      key={criterion}
                      className={cn(
                        "flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold transition-colors duration-300 motion-reduce:transition-none",
                        index < checked
                          ? "bg-[#e6f8ee] text-[#0e1310]"
                          : index === checked
                            ? "animate-pulse bg-[#f0f4f1] text-[#0e1310] motion-reduce:animate-none"
                            : "bg-[#f0f4f1] text-muted-foreground"
                      )}
                    >
                      {index < checked && <Check className="h-2.5 w-2.5 text-[#00a854]" strokeWidth={3} aria-hidden />}
                      {criterion}
                    </span>
                  ))
                ) : (
                  <span className="text-[11px] text-muted-foreground">Le dispatcher analyse GPS, charge et trajets.</span>
                )}
              </div>

              <div className="grid min-h-0 flex-1 grid-cols-3 gap-2">
                {TOUR_LANES.map((lane) => {
                  const orders = TOUR_QUEUE.filter((order) => order.driver === lane.driver && placed.has(order.number));
                  const grouped = orders.filter((order) => order.grouped).length > 1;
                  return (
                    <section
                      key={lane.driver}
                      aria-label={`Tournée de ${lane.driver}`}
                      className={cn(
                        "flex min-w-0 flex-col gap-1.5 rounded-2xl bg-white p-2 ring-1 transition-colors duration-300",
                        grouped ? "ring-[#00d46a]/50" : "ring-black/[0.05]"
                      )}
                    >
                      <div className="flex items-center gap-1.5">
                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#0e1310] text-[10px] font-bold text-white" aria-hidden>
                          {lane.driver[0]}
                        </span>
                        <div className="min-w-0 leading-tight">
                          <p className="truncate text-[11px] font-semibold">{lane.driver}</p>
                          <p className="truncate text-[10px] text-muted-foreground">{lane.area}</p>
                        </div>
                      </div>
                      {orders.map((order) => (
                        <OrderChip key={order.number} order={order} placed />
                      ))}
                      {grouped && (
                        <p className="product-tour-in flex items-center gap-1 text-[10px] font-semibold text-[#00a854]">
                          <Layers className="h-3 w-3 shrink-0" aria-hidden />
                          Tournée groupée
                        </p>
                      )}
                    </section>
                  );
                })}
              </div>

              <p
                className={cn(
                  "flex items-center justify-center gap-1 text-[11px] text-muted-foreground transition-opacity duration-300 motion-reduce:transition-none",
                  phase === "before" && ready ? "opacity-100" : "opacity-0",
                  phase === "after" && "hidden"
                )}
                aria-hidden
              >
                <MousePointerClick className="h-3 w-3" />
                Cliquez sur « Lancer le dispatcher intelligent »
              </p>
            </div>
          </LayoutGroup>

          <aside aria-label="Explications du dispatch" className="flex shrink-0 flex-col gap-2 sm:w-[200px] lg:w-[220px]">
            <PhaseSteps phase={phase} />
            {(launched || arrival >= 1) && <GuideSpot id="dispatch" lines={bubbles} className="relative block h-0 w-full" />}
            {canContinue && (
              <motion.button
                type="button"
                data-tour-target
                onClick={onDone}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ type: "spring", stiffness: 300, damping: 26 }}
                className="product-tour-pulse mt-auto flex min-h-10 max-md:min-h-11 w-full items-center justify-center gap-1.5 rounded-xl bg-[#0e1310] px-3 text-xs font-semibold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                Passer à la suite
                <ArrowRight className="h-3.5 w-3.5" aria-hidden />
              </motion.button>
            )}
          </aside>
        </div>
      </div>
    </div>
  );
}
