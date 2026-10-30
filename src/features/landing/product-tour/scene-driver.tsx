"use client";

import { useState } from "react";
import { Bell, CornerUpLeft, MousePointerClick, Navigation, Play } from "lucide-react";
import { cn } from "@/lib/utils";
import { CityMap } from "@/features/landing/product-tour/city-map";
import { PhoneFrame } from "@/features/landing/product-tour/phone-frame";
import type { SceneProps } from "@/features/landing/product-tour/product-tour";
import { GuideSpot } from "@/features/landing/product-tour/guide-bubble";
import { TOUR_ORDER } from "@/features/landing/product-tour/tour-data";
import {
  GESTURE_RESULT_DELAY_MS,
  useDelayedCall,
  useTimeline,
} from "@/features/landing/product-tour/use-timeline";

const ARRIVAL_DURATIONS_MS = [450, 600, 450] as const;
/** La vue GPS reste affichée un peu plus longtemps qu'un simple résultat de geste. */
const NAVIGATION_VIEW_MS = GESTURE_RESULT_DELAY_MS * 2;

const gestureButton =
  "flex min-h-10 max-md:min-h-11 w-full items-center justify-center gap-1.5 rounded-xl px-3 text-xs font-semibold transition-opacity duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 motion-reduce:transition-none";

function MissionDetails({
  phase,
  ready,
  accepted,
  onAccept,
  onNavigate,
}: {
  phase: number;
  ready: boolean;
  accepted: boolean;
  onAccept: () => void;
  onNavigate: () => void;
}) {
  return (
    <div className="flex h-full flex-col px-3 pb-3 pt-2">
      <p className="text-[11px] text-muted-foreground">Bonjour Lucas</p>
      <p className="text-sm font-bold">Mes missions</p>

      {phase >= 1 && (
        <div className="product-tour-in mt-2 flex items-center gap-2 rounded-xl bg-[#0e1310] px-2.5 py-2 text-white shadow-lg">
          <Bell className="h-3.5 w-3.5 shrink-0 text-[#00d46a]" aria-hidden />
          <p className="text-[11px] font-semibold leading-tight">Nouvelle mission · {TOUR_ORDER.number}</p>
        </div>
      )}

      {phase >= 2 && (
        <div className="product-tour-in mt-2 rounded-xl border border-black/[0.07] bg-white p-2.5">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold">{TOUR_ORDER.number}</p>
            <span className="rounded-full bg-[#eaf2ff] px-1.5 py-0.5 text-[10px] font-semibold text-[#1d4f9e]">
              {accepted ? "Prise en charge" : "Attribuée"}
            </span>
          </div>
          <ol className="mt-2 space-y-2">
            <li className="flex gap-2">
              <span className="mt-1 h-2 w-2 shrink-0 rounded-sm bg-[#0e1310]" aria-hidden />
              <div className="min-w-0 leading-tight">
                <p className="text-[10px] text-muted-foreground">Retrait</p>
                <p className="truncate text-[11px] font-semibold">{TOUR_ORDER.pickup}</p>
              </div>
            </li>
            <li className="flex gap-2">
              <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-[#00d46a]" aria-hidden />
              <div className="min-w-0 leading-tight">
                <p className="text-[10px] text-muted-foreground">Livraison · {TOUR_ORDER.slot}</p>
                <p className="text-[11px] font-semibold">{TOUR_ORDER.dropoff}</p>
              </div>
            </li>
          </ol>

          <div className="mt-2.5 flex flex-col gap-1.5">
            {accepted ? (
              <>
                <span className={cn(gestureButton, "bg-primary text-primary-foreground")} aria-hidden>
                  <Play className="h-3.5 w-3.5" />
                  Commencer la mission
                </span>
                <button type="button" data-tour-target onClick={onNavigate} className={cn(gestureButton, "product-tour-pulse border border-border bg-white")}>
                  <Navigation className="h-3.5 w-3.5" aria-hidden />
                  Naviguer
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  data-tour-target
                  disabled={!ready}
                  onClick={onAccept}
                  className={cn(gestureButton, "bg-primary text-primary-foreground", ready ? "product-tour-pulse" : "opacity-40")}
                >
                  Prendre en charge
                </button>
                <span className={cn(gestureButton, "border border-border font-medium text-muted-foreground")} aria-hidden>
                  Refuser / indisponible
                </span>
              </>
            )}
          </div>
        </div>
      )}

      <p
        className={cn(
          "mt-auto flex items-center justify-center gap-1 pt-2 text-[10px] text-muted-foreground transition-opacity duration-300 motion-reduce:transition-none",
          ready ? "opacity-100" : "opacity-0"
        )}
        aria-hidden={!ready}
      >
        <MousePointerClick className="h-3 w-3" aria-hidden />
        {accepted ? "Cliquez sur « Naviguer »" : "Cliquez sur « Prendre en charge »"}
      </p>
    </div>
  );
}

function NavigationView() {
  return (
    <div className="product-tour-in relative h-full">
      <CityMap variant="driver" showRoute progress={0.04} />
      <div className="absolute inset-x-2 top-2 flex items-center gap-2 rounded-xl bg-[#0e1310] px-2.5 py-2 text-white shadow-lg">
        <CornerUpLeft className="h-4 w-4 shrink-0 text-[#00d46a]" aria-hidden />
        <p className="text-[11px] font-semibold leading-tight">Dans 300 m, tournez à gauche</p>
      </div>
      <div className="absolute inset-x-2 bottom-2 rounded-xl bg-white px-2.5 py-2 shadow-lg ring-1 ring-black/[0.05]">
        <p className="text-[11px] font-semibold">Arrivée vers 14 h 21</p>
        <p className="text-[10px] text-muted-foreground">Rue de la Roquette, Paris 11e</p>
      </div>
    </div>
  );
}

/** ③ App livreur : la mission arrive, le visiteur la prend en charge puis lance la navigation. */
export function SceneDriver({ onDone, reducedMotion }: SceneProps) {
  const phase = useTimeline(ARRIVAL_DURATIONS_MS, reducedMotion);
  const [accepted, setAccepted] = useState(false);
  const [navigating, setNavigating] = useState(false);
  const ready = phase >= ARRIVAL_DURATIONS_MS.length;
  useDelayedCall(navigating, NAVIGATION_VIEW_MS, onDone);

  return (
    <div className="relative flex h-full items-center justify-center px-4 py-4">
      <PhoneFrame time="14:02">
        {navigating ? (
          <NavigationView />
        ) : (
          <MissionDetails
            phase={phase}
            ready={ready}
            accepted={accepted}
            onAccept={() => setAccepted(true)}
            onNavigate={() => setNavigating(true)}
          />
        )}
      </PhoneFrame>
      <GuideSpot
        id="driver"
        className="left-6 top-8"
        lines={[navigating ? "GPS lancé en un geste." : accepted ? "Le client le voit aussitôt." : "Mission reçue, sans un appel."]}
      />
    </div>
  );
}
