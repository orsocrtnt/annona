"use client";

import { useState } from "react";
import { CalendarClock, CheckCircle2, MapPin, MousePointerClick, Warehouse } from "lucide-react";
import { cn } from "@/lib/utils";
import type { SceneProps } from "@/features/landing/product-tour/product-tour";
import { TOUR_ORDER } from "@/features/landing/product-tour/tour-data";
import {
  GESTURE_RESULT_DELAY_MS,
  useDelayedCall,
  useTimeline,
} from "@/features/landing/product-tour/use-timeline";

const FILL_DURATIONS_MS = [500, 550, 550, 450] as const;

const FIELDS = [
  { icon: Warehouse, label: "Retrait", value: TOUR_ORDER.pickup },
  { icon: MapPin, label: "Livraison", value: TOUR_ORDER.dropoff },
  { icon: CalendarClock, label: "Créneau", value: `Aujourd'hui · ${TOUR_ORDER.slot}` },
] as const;

/** ① Espace client : le formulaire se remplit, le visiteur clique sur « Commander ». */
export function SceneClientOrder({ onDone, reducedMotion }: SceneProps) {
  const phase = useTimeline(FILL_DURATIONS_MS, reducedMotion);
  const [ordered, setOrdered] = useState(false);
  const ready = phase >= FIELDS.length + 1;
  useDelayedCall(ordered, GESTURE_RESULT_DELAY_MS, onDone);

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-black/[0.06] bg-white px-4 py-3 sm:px-5">
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#0e1310] text-[11px] font-bold text-white" aria-hidden>
            AV
          </span>
          <div className="leading-tight">
            <p className="text-xs text-muted-foreground">Espace client</p>
            <p className="text-sm font-semibold">{TOUR_ORDER.client}</p>
          </div>
        </div>
        <span className="rounded-full bg-[#f0f4f1] px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
          Commandes
        </span>
      </div>

      <div className="flex flex-1 flex-col px-4 py-4 sm:px-8 sm:py-7">
        <p className="text-lg font-bold tracking-[-0.02em]">Nouvelle commande</p>
        <p className="mt-1 text-xs text-muted-foreground">Livraison standard · colis de 4 kg</p>

        <ul className="mt-3 space-y-2 sm:mt-5 sm:space-y-2.5">
          {FIELDS.map(({ icon: Icon, label, value }, index) => {
            const filled = phase > index;
            return (
              <li key={label} className="flex items-center gap-3 rounded-xl border border-black/[0.07] bg-white px-3 py-2 sm:py-2.5">
                <Icon className="h-4 w-4 shrink-0 text-muted-foreground" strokeWidth={1.75} aria-hidden />
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] font-medium text-muted-foreground">{label}</p>
                  {filled ? (
                    <p className="product-tour-in truncate text-sm font-medium">{value}</p>
                  ) : (
                    <span className="mt-1 block h-3.5 w-2/3 rounded bg-[#eef1ef]" aria-hidden />
                  )}
                </div>
              </li>
            );
          })}
        </ul>

        <div className="mt-auto pt-3 sm:pt-5">
          {ordered ? (
            <p className="product-tour-in flex items-center justify-center gap-2 rounded-xl bg-[#e6f8ee] px-4 py-3 text-sm font-semibold text-[#0e1310]">
              <CheckCircle2 className="h-4 w-4 text-[#00a854]" aria-hidden />
              Commande {TOUR_ORDER.number} envoyée
            </p>
          ) : (
            <>
              <button
                type="button"
                disabled={!ready}
                onClick={() => setOrdered(true)}
                className={cn(
                  "flex min-h-11 w-full items-center justify-center rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 motion-reduce:transition-none",
                  ready ? "product-tour-pulse" : "opacity-40"
                )}
              >
                Commander
              </button>
              <p
                className={cn(
                  "mt-2 flex items-center justify-center gap-1.5 text-xs text-muted-foreground transition-opacity motion-reduce:transition-none",
                  ready ? "opacity-100" : "opacity-0"
                )}
                aria-hidden={!ready}
              >
                <MousePointerClick className="h-3.5 w-3.5" aria-hidden />
                Cliquez pour commander
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
