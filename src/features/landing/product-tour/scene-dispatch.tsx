"use client";

import { useState } from "react";
import { Check, MousePointerClick, Route, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { SceneProps } from "@/features/landing/product-tour/product-tour";
import { TOUR_DISPATCH_REASON, TOUR_DRIVERS, TOUR_ORDER } from "@/features/landing/product-tour/tour-data";
import {
  GESTURE_RESULT_DELAY_MS,
  useDelayedCall,
  useTimeline,
} from "@/features/landing/product-tour/use-timeline";

const ARRIVAL_DURATIONS_MS = [350, 450] as const;
/** Un livreur examiné par intervalle, puis l'attribution. */
const EXAMINE_DURATIONS_MS = [450, 450, 450, 400] as const;
const NOT_LAUNCHED: readonly number[] = [];

function OrderCard({ assigned }: { assigned: boolean }) {
  return (
    <div
      className={cn(
        "product-tour-in rounded-xl border p-2.5 text-left",
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
    </div>
  );
}

function Column({ title, tone, children }: { title: string; tone: "amber" | "blue"; children?: React.ReactNode }) {
  return (
    <div className="min-w-0 rounded-2xl bg-white p-2.5 ring-1 ring-black/[0.05]">
      <p className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold text-muted-foreground">
        <span className={cn("h-2 w-2 rounded-full", tone === "amber" ? "bg-[#f0a92e]" : "bg-[#3b82f6]")} aria-hidden />
        {title}
      </p>
      <div className="min-h-[74px]">{children}</div>
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
  useDelayedCall(assigned, GESTURE_RESULT_DELAY_MS, onDone);

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-black/[0.06] bg-white px-4 py-3 sm:px-5">
        <div className="leading-tight">
          <p className="text-xs text-muted-foreground">Espace entreprise</p>
          <p className="text-sm font-semibold">Dispatch du jour</p>
        </div>
        <span className="rounded-full bg-[#f0f4f1] px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
          Mardi
        </span>
      </div>

      <div className="flex flex-1 flex-col gap-3 px-3 py-4 sm:px-6 sm:py-5">
        <div className="grid grid-cols-2 gap-2.5">
          <Column title="Sans livreur" tone="amber">
            {phase >= 1 && !assigned && <OrderCard assigned={false} />}
          </Column>
          <Column title="À démarrer" tone="blue">
            {assigned && <OrderCard assigned />}
          </Column>
        </div>

        <div className="mt-auto rounded-2xl bg-white p-3 ring-1 ring-black/[0.05]">
          {launched ? (
            <DriverReview phase={examined} assigned={assigned} />
          ) : (
            <>
              <p className="text-xs text-muted-foreground">
                Le dispatcher choisit le livreur selon sa disponibilité, sa zone et sa charge.
              </p>
              <button
                type="button"
                disabled={!ready}
                onClick={() => setLaunched(true)}
                className={cn(
                  "mt-3 flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 motion-reduce:transition-none",
                  ready ? "product-tour-pulse" : "opacity-40"
                )}
              >
                <Route className="h-4 w-4" aria-hidden />
                Lancer le dispatcher intelligent
              </button>
              <p
                className={cn(
                  "mt-2 flex items-center justify-center gap-1.5 text-xs text-muted-foreground transition-opacity motion-reduce:transition-none",
                  ready ? "opacity-100" : "opacity-0"
                )}
                aria-hidden={!ready}
              >
                <MousePointerClick className="h-3.5 w-3.5" aria-hidden />
                Cliquez pour attribuer la livraison
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
