"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, MotionConfig, motion } from "motion/react";
import { Building2, Lock, Truck, UserRound } from "lucide-react";
import { cn } from "@/lib/utils";
import { SceneClientOrder } from "@/features/landing/product-tour/scene-client-order";
import { SceneDispatch } from "@/features/landing/product-tour/scene-dispatch";
import { SceneDriver } from "@/features/landing/product-tour/scene-driver";
import { SceneTracking } from "@/features/landing/product-tour/scene-tracking";
import { interludeFor, type TourInterlude } from "@/features/landing/product-tour/tour-data";
import {
  TOUR_STEP_LABELS,
  TOUR_STEPS,
  advanceTour,
  goToStep,
  initialTourState,
  restartTour,
  type TourStep,
} from "@/features/landing/product-tour/tour-machine";
import { useDelayedCall, usePrefersReducedMotion } from "@/features/landing/product-tour/use-timeline";

export type SceneProps = {
  onDone: () => void;
  /** Premier geste du visiteur : la fenêtre de la démo s'agrandit. */
  onStart: () => void;
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

const SPACE_LABELS: Record<TourStep, string> = {
  order: "Espace client",
  dispatch: "Espace entreprise · Dispatch",
  driver: "App livreur",
  tracking: "Espace client · Suivi",
};

const INTERLUDE_ICONS = { company: Building2, driver: Truck, client: UserRound } as const;

/** Durée d'affichage d'un carton, fondus compris. */
const INTERLUDE_MS = 1900;
const REDUCED_INTERLUDE_MS = 1200;
/** Courbe douce, sans rebond : sortie rapide, arrivée qui se pose. */
const EASE_OUT = [0.22, 1, 0.36, 1] as const;

function InterludeCard({ interlude, durationMs }: { interlude: TourInterlude; durationMs: number }) {
  const Icon = INTERLUDE_ICONS[interlude.space];
  return (
    <div className="flex h-full flex-col items-center justify-center bg-[radial-gradient(ellipse_80%_60%_at_50%_40%,#e3f7ec_0%,#f5f8f6_70%)] px-8 text-center">
      <motion.span
        initial={{ scale: 0.6, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 260, damping: 22, delay: 0.1 }}
        className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#0e1310] text-[#00d46a] shadow-[0_16px_40px_rgba(14,19,16,0.22)]"
        aria-hidden
      >
        <Icon className="h-6 w-6" strokeWidth={1.75} />
      </motion.span>
      <motion.p
        initial={{ y: 10, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.5, ease: EASE_OUT, delay: 0.18 }}
        className="mt-5 text-xl font-bold tracking-[-0.02em] sm:text-2xl"
      >
        {interlude.title}
      </motion.p>
      <motion.p
        initial={{ y: 10, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.5, ease: EASE_OUT, delay: 0.28 }}
        className="mt-2 text-sm text-muted-foreground"
      >
        {interlude.text}
      </motion.p>
      <div className="mt-6 h-1 w-24 overflow-hidden rounded-full bg-[#dfe7e2]" aria-hidden>
        <motion.span
          className="block h-full rounded-full bg-[#00d46a]"
          initial={{ width: "0%" }}
          animate={{ width: "100%" }}
          transition={{ duration: durationMs / 1000 - 0.4, ease: "linear", delay: 0.2 }}
        />
      </div>
    </div>
  );
}

/** Mini-démo du hero : le visiteur fait lui-même chaque geste du parcours d'une livraison. */
export function ProductTour() {
  const [state, setState] = useState(initialTourState);
  const [interacted, setInteracted] = useState(false);
  const [interlude, setInterlude] = useState<TourInterlude | null>(null);
  const [started, setStarted] = useState(false);
  const reducedMotion = usePrefersReducedMotion();
  const stage = useRef<HTMLDivElement>(null);
  const step = TOUR_STEPS[state.current] ?? "order";
  const interludeMs = reducedMotion ? REDUCED_INTERLUDE_MS : INTERLUDE_MS;

  const onDone = useCallback(() => {
    setInteracted(true);
    const next = TOUR_STEPS[TOUR_STEPS.indexOf(step) + 1];
    if (next) setInterlude(interludeFor(step, next));
    setState((previous) => advanceTour(previous, step));
  }, [step]);

  useDelayedCall(interlude !== null, interludeMs, () => setInterlude(null));

  const showing = interlude ? `interlude-${step}` : step;
  useEffect(() => {
    const element = stage.current;
    if (!interacted || !element) return;
    // Ne reprend le focus que s'il est resté dans la démo ou s'est perdu sur la page.
    const active = document.activeElement;
    const tour = element.closest("figure");
    if (active && active !== document.body && !tour?.contains(active)) return;
    element.focus({ preventScroll: true });
  }, [interacted, showing]);

  const onStart = useCallback(() => setStarted(true), []);
  const sceneProps: SceneProps = { onDone, onStart, reducedMotion, interacted };

  const navigate = (next: typeof state) => {
    setInteracted(true);
    setInterlude(null);
    setState(next);
  };

  return (
    <MotionConfig reducedMotion="user">
      <figure
        aria-label="Démonstration interactive du parcours d'une livraison"
        data-started={started ? "true" : "false"}
        className={cn(
          "relative z-10 origin-center overflow-hidden rounded-[22px] border border-black/[0.07] bg-white p-1.5 transition-[scale,box-shadow] duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none lg:origin-right",
          started
            ? "scale-[1.02] shadow-[0_40px_110px_rgba(14,19,16,0.2)] lg:scale-[1.07]"
            : "shadow-[0_30px_80px_rgba(14,19,16,0.12)]"
        )}
      >
        <div className="flex items-center gap-3 px-2 py-2 sm:px-3">
          <div className="hidden items-center gap-1.5 sm:flex" aria-hidden>
            <span className="h-2.5 w-2.5 rounded-full bg-[#e4e8e5]" />
            <span className="h-2.5 w-2.5 rounded-full bg-[#e4e8e5]" />
            <span className="h-2.5 w-2.5 rounded-full bg-[#e4e8e5]" />
          </div>
          <div className="mx-auto flex h-7 min-w-0 max-w-[280px] flex-1 items-center justify-center gap-1.5 overflow-hidden rounded-lg bg-[#f0f4f1] px-3 text-xs font-medium text-muted-foreground">
            <Lock className="h-3 w-3 shrink-0" aria-hidden />
            <AnimatePresence mode="wait" initial={false}>
              <motion.span
                key={step}
                initial={{ y: 8, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: -8, opacity: 0 }}
                transition={{ duration: 0.3, ease: EASE_OUT }}
                className="truncate"
              >
                TutelLiv · <span className="text-foreground">{SPACE_LABELS[step]}</span>
              </motion.span>
            </AnimatePresence>
          </div>
          <div className="hidden w-[54px] sm:block" aria-hidden />
        </div>

        <p aria-live="polite" className="sr-only">
          {interlude
            ? `${interlude.title} ${interlude.text}`
            : `Étape ${state.current + 1} sur ${TOUR_STEPS.length} · ${SCENE_TITLES[step]}`}
        </p>

        <div
          ref={stage}
          tabIndex={-1}
          className="relative h-[420px] overflow-hidden rounded-[16px] bg-[#f5f8f6] focus:outline-none sm:h-[460px]"
        >
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={showing}
              className="absolute inset-0"
              initial={{ opacity: 0, scale: 1.02, filter: "blur(6px)" }}
              animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
              exit={{ opacity: 0, scale: 0.98, filter: "blur(6px)" }}
              transition={{ duration: 0.42, ease: EASE_OUT }}
            >
              {interlude ? (
                <InterludeCard interlude={interlude} durationMs={interludeMs} />
              ) : (
                <>
                  {step === "order" && <SceneClientOrder {...sceneProps} />}
                  {step === "dispatch" && <SceneDispatch {...sceneProps} />}
                  {step === "driver" && <SceneDriver {...sceneProps} />}
                  {step === "tracking" && (
                    <SceneTracking
                      {...sceneProps}
                      onRestart={() => {
                        setStarted(false);
                        navigate(restartTour());
                      }}
                    />
                  )}
                </>
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        <ol aria-label="Étapes de la démonstration" className="grid grid-cols-4 gap-1 px-1 pb-0.5 pt-1.5">
          {TOUR_STEPS.map((item, index) => {
            const isCurrent = index === state.current;
            const locked = index > state.reached;
            return (
              <li key={item}>
                <button
                  type="button"
                  disabled={locked}
                  aria-current={isCurrent ? "step" : undefined}
                  onClick={() => navigate(goToStep(state, item))}
                  className={cn(
                    "relative flex w-full items-center justify-center gap-1 rounded-lg px-1 py-1.5 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transition-none sm:gap-1.5 sm:px-2.5",
                    !isCurrent && !locked && "text-muted-foreground hover:bg-[#f0f4f1]",
                    locked && "cursor-not-allowed text-muted-foreground/50"
                  )}
                >
                  {isCurrent && (
                    <motion.span
                      layoutId="product-tour-step"
                      className="absolute inset-0 rounded-lg bg-[#e6f8ee]"
                      transition={{ type: "spring", stiffness: 380, damping: 34 }}
                      aria-hidden
                    />
                  )}
                  <span
                    className={cn(
                      "relative flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[10px] transition-colors duration-300",
                      isCurrent ? "bg-[#00d46a] text-[#0e1310]" : "bg-[#eef1ef]"
                    )}
                    aria-hidden
                  >
                    {index + 1}
                  </span>
                  <span className="relative">{TOUR_STEP_LABELS[item]}</span>
                </button>
              </li>
            );
          })}
        </ol>
      </figure>
    </MotionConfig>
  );
}
