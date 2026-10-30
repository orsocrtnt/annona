"use client";

import { useEffect, useState } from "react";
import { Check, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { CityMap } from "@/features/landing/product-tour/city-map";
import type { SceneProps } from "@/features/landing/product-tour/product-tour";
import { GuideSpot } from "@/features/landing/product-tour/guide-bubble";
import { TOUR_ORDER } from "@/features/landing/product-tour/tour-data";
import { GESTURE_RESULT_DELAY_MS, useDelayedCall } from "@/features/landing/product-tour/use-timeline";

const RIDE_DURATION_MS = 6500;
const RIDE_MINUTES = 12;

function useRideProgress(reducedMotion: boolean): number {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (reducedMotion) return;
    let frame = 0;
    const startedAt = performance.now();
    const tick = (now: number) => {
      const next = Math.min((now - startedAt) / RIDE_DURATION_MS, 1);
      setProgress(next);
      if (next < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [reducedMotion]);

  return reducedMotion ? 1 : progress;
}

/** ④ Espace client : le livreur avance sur la carte jusqu'à l'adresse, puis la remise commence. */
export function SceneTracking({ onDone, reducedMotion }: SceneProps) {
  const progress = useRideProgress(reducedMotion);
  const delivered = progress >= 1;
  useDelayedCall(delivered, GESTURE_RESULT_DELAY_MS + 300, onDone);
  const minutes = Math.max(1, Math.ceil(RIDE_MINUTES * (1 - progress)));

  const timeline = [
    { label: "Commandée", done: true },
    { label: "Attribuée à Lucas", done: true },
    { label: "En route", done: delivered, active: !delivered },
    { label: "Arrivé", done: delivered },
  ];

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-black/[0.06] bg-white px-4 py-3 sm:px-5">
        <div className="leading-tight">
          <p className="text-xs text-muted-foreground">Espace client · {TOUR_ORDER.client}</p>
          <p className="text-sm font-semibold">Suivi de la commande {TOUR_ORDER.number}</p>
        </div>
        <span
          className={cn(
            "rounded-full px-2.5 py-1 text-[11px] font-semibold",
            delivered ? "bg-[#e6f8ee] text-[#0e1310]" : "bg-[#eaf2ff] text-[#1d4f9e]"
          )}
        >
          {delivered ? "Arrivé" : "En route"}
        </span>
      </div>

      <div className="relative min-h-0 flex-1">
        <CityMap variant="client" showRoute progress={progress} />
        <GuideSpot
          id="tracking"
          className="left-4 top-4"
          lines={["Le client suit. Il n'appelle plus.", ...(progress >= 0.4 ? ["Heure d'arrivée en direct."] : [])]}
        />
      </div>

      <div className="border-t border-black/[0.06] bg-white px-4 py-3 sm:px-5">
        <div className="min-h-[92px]">
          {delivered ? (
            <div className="product-tour-in">
              <p className="flex items-center gap-2 text-sm font-bold">
                <CheckCircle2 className="h-5 w-5 text-[#00a854]" aria-hidden />
                Lucas est arrivé
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {TOUR_ORDER.dropoff} · remise en cours
              </p>
            </div>
          ) : (
            <>
              <div className="flex items-baseline justify-between gap-2">
                <p className="text-sm font-bold">Lucas arrive dans {minutes} min</p>
                <p className="text-[11px] text-muted-foreground">{TOUR_ORDER.slot}</p>
              </div>
              <ol className="mt-2.5 grid grid-cols-4 gap-1.5" aria-label="Étapes de la livraison">
                {timeline.map((item) => (
                  <li key={item.label} className="min-w-0">
                    <span
                      className={cn(
                        "block h-1.5 rounded-full",
                        item.done ? "bg-[#00d46a]" : item.active ? "animate-pulse bg-[#00d46a]/50 motion-reduce:animate-none" : "bg-[#e4e8e5]"
                      )}
                      aria-hidden
                    />
                    <p className={cn("mt-1 flex items-center gap-0.5 truncate text-[10px]", item.done || item.active ? "font-semibold" : "text-muted-foreground")}>
                      {item.done && <Check className="h-2.5 w-2.5 shrink-0 text-[#00a854]" strokeWidth={3} aria-hidden />}
                      {item.label}
                    </p>
                  </li>
                ))}
              </ol>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
