"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { SceneClientOrder } from "@/features/landing/product-tour/scene-client-order";
import { SceneDispatch } from "@/features/landing/product-tour/scene-dispatch";
import { SceneDriver } from "@/features/landing/product-tour/scene-driver";
import {
  TOUR_STEP_LABELS,
  TOUR_STEPS,
  advanceTour,
  goToStep,
  initialTourState,
  type TourStep,
} from "@/features/landing/product-tour/tour-machine";
import { usePrefersReducedMotion } from "@/features/landing/product-tour/use-timeline";

export type SceneProps = {
  onDone: () => void;
  reducedMotion: boolean;
  /** Vrai dès le premier geste du visiteur : avant, on ne déplace jamais le focus. */
  interacted: boolean;
};

const SCENE_TITLES: Record<TourStep, string> = {
  order: "Espace client : le client passe une commande",
  dispatch: "Espace entreprise : le dispatcher intelligent attribue la livraison",
  driver: "App livreur : le livreur reçoit la mission et lance la navigation",
  tracking: "Espace client : le client suit sa livraison sur la carte",
};

function PendingScene({ step, onDone }: SceneProps & { step: TourStep }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 p-6 text-center">
      <p className="text-sm text-muted-foreground">{SCENE_TITLES[step]}</p>
      {step !== "tracking" && (
        <button
          type="button"
          onClick={onDone}
          className="rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground"
        >
          Continuer
        </button>
      )}
    </div>
  );
}

/** Mini-démo du hero : le visiteur fait lui-même chaque geste du parcours d'une livraison. */
export function ProductTour() {
  const [state, setState] = useState(initialTourState);
  const [interacted, setInteracted] = useState(false);
  const reducedMotion = usePrefersReducedMotion();
  const stage = useRef<HTMLDivElement>(null);
  const step = TOUR_STEPS[state.current] ?? "order";

  const onDone = useCallback(() => {
    setInteracted(true);
    setState((previous) => advanceTour(previous, step));
  }, [step]);

  const currentIndex = state.current;
  useEffect(() => {
    if (interacted) stage.current?.focus({ preventScroll: true });
  }, [interacted, currentIndex]);

  const sceneProps: SceneProps = { onDone, reducedMotion, interacted };

  return (
    <figure
      aria-label="Démonstration interactive du parcours d'une livraison"
      className="overflow-hidden rounded-[22px] border border-black/[0.07] bg-white p-1.5 shadow-[0_30px_80px_rgba(14,19,16,0.12)]"
    >
      <div className="flex items-center gap-3 px-2 py-2 sm:px-3">
        <div className="hidden items-center gap-1.5 sm:flex" aria-hidden>
          <span className="h-2.5 w-2.5 rounded-full bg-[#e4e8e5]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#e4e8e5]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#e4e8e5]" />
        </div>
        <ol aria-label="Étapes de la démonstration" className="grid flex-1 grid-cols-4 gap-1 sm:ml-auto sm:flex sm:flex-none">
          {TOUR_STEPS.map((item, index) => {
            const isCurrent = index === state.current;
            const locked = index > state.reached;
            return (
              <li key={item}>
                <button
                  type="button"
                  disabled={locked}
                  aria-current={isCurrent ? "step" : undefined}
                  onClick={() => {
                    setInteracted(true);
                    setState((previous) => goToStep(previous, item));
                  }}
                  className={cn(
                    "flex w-full items-center justify-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transition-none sm:px-2.5",
                    isCurrent && "bg-[#e6f8ee] text-[#0e1310]",
                    !isCurrent && !locked && "text-muted-foreground hover:bg-[#f0f4f1]",
                    locked && "cursor-not-allowed text-muted-foreground/50"
                  )}
                >
                  <span
                    className={cn(
                      "flex h-4 w-4 items-center justify-center rounded-full text-[10px]",
                      isCurrent ? "bg-[#00d46a] text-[#0e1310]" : "bg-[#eef1ef]"
                    )}
                    aria-hidden
                  >
                    {index + 1}
                  </span>
                  {TOUR_STEP_LABELS[item]}
                </button>
              </li>
            );
          })}
        </ol>
      </div>

      <p aria-live="polite" className="sr-only">
        {`Étape ${state.current + 1} sur ${TOUR_STEPS.length} · ${SCENE_TITLES[step]}`}
      </p>

      <div
        ref={stage}
        tabIndex={-1}
        className="relative h-[420px] overflow-hidden rounded-[16px] bg-[#f5f8f6] focus:outline-none sm:h-[460px]"
      >
        {step === "order" && <SceneClientOrder key={step} {...sceneProps} />}
        {step === "dispatch" && <SceneDispatch key={step} {...sceneProps} />}
        {step === "driver" && <SceneDriver key={step} {...sceneProps} />}
        {step === "tracking" && <PendingScene key={step} step={step} {...sceneProps} />}
      </div>
    </figure>
  );
}
