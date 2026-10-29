"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, MotionConfig, motion } from "motion/react";
import { Building2, Lock, Truck, UserRound } from "lucide-react";
import { cn } from "@/lib/utils";
import { GuideBubble } from "@/features/landing/product-tour/guide-bubble";
import { GuideCursor } from "@/features/landing/product-tour/guide-cursor";
import { SceneClientOrder } from "@/features/landing/product-tour/scene-client-order";
import { SceneDispatch } from "@/features/landing/product-tour/scene-dispatch";
import { SceneDriver } from "@/features/landing/product-tour/scene-driver";
import { SceneInvoices } from "@/features/landing/product-tour/scene-invoices";
import { SceneProof } from "@/features/landing/product-tour/scene-proof";
import { SceneReceipt } from "@/features/landing/product-tour/scene-receipt";
import { SceneTracking } from "@/features/landing/product-tour/scene-tracking";
import { TourCover } from "@/features/landing/product-tour/tour-cover";
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
  /** « Annuler » : retour à l'écran de départ, fenêtre à sa taille. */
  onReset: () => void;
  reducedMotion: boolean;
  /** Vrai dès le premier geste du visiteur : avant, on ne déplace jamais le focus. */
  interacted: boolean;
};

const SCENE_TITLES: Record<TourStep, string> = {
  order: "Espace client : le client passe une commande",
  dispatch: "Espace entreprise : le dispatcher intelligent attribue la livraison",
  driver: "App livreur : le livreur reçoit la mission et lance la navigation",
  tracking: "Espace client : le client suit sa livraison sur la carte",
  proof: "App livreur : le livreur prend la preuve de livraison",
  receipt: "Espace client : livraison confirmée et facture reçue par e-mail",
  invoices: "Espace entreprise : suivi des paiements et relance des impayés",
};

const SPACE_LABELS: Record<TourStep, string> = {
  order: "Espace client",
  dispatch: "Espace entreprise · Dispatch",
  driver: "App livreur",
  tracking: "Espace client · Suivi",
  proof: "App livreur",
  receipt: "Espace client · Commandes",
  invoices: "Espace entreprise · Facturation",
};

const INTERLUDE_ICONS = { company: Building2, driver: Truck, client: UserRound } as const;

/** Durée d'affichage d'un carton, fondus compris. */
const INTERLUDE_MS = 2100;
const REDUCED_INTERLUDE_MS = 1400;


/** Courbe douce, sans rebond : sortie rapide, arrivée qui se pose. */
const EASE_OUT = [0.22, 1, 0.36, 1] as const;
/** Le temps que la bulle redevienne une boule avant le changement d'écran. */
const LEAVE_MS = 550;

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
  /** Chaque visite d'une scène a sa propre clé : une scène en train de sortir n'est jamais réutilisée. */
  const [visit, setVisit] = useState(0);
  const reducedMotion = usePrefersReducedMotion();
  const stage = useRef<HTMLDivElement>(null);
  const step = TOUR_STEPS[state.current] ?? "order";
  const interludeMs = reducedMotion ? REDUCED_INTERLUDE_MS : INTERLUDE_MS;

  /** Fin d'étape : la bulle se remet d'abord en boule, puis l'écran change. */
  const [leaving, setLeaving] = useState(false);
  const onDone = useCallback(() => setLeaving(true), []);
  useDelayedCall(leaving, reducedMotion ? 0 : LEAVE_MS, () => {
    setLeaving(false);
    setInteracted(true);
    const next = TOUR_STEPS[TOUR_STEPS.indexOf(step) + 1];
    if (next) setInterlude(interludeFor(step, next));
    setVisit((previous) => previous + 1);
    setState((previous) => advanceTour(previous, step));
  });

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

  // La démo occupe toute la largeur de sa section (LANDING-3) : le départ ne l'agrandit plus.
  const onStart = useCallback(() => setStarted(true), []);

  const navigate = (next: typeof state) => {
    setInteracted(true);
    setInterlude(null);
    setLeaving(false);
    setVisit((previous) => previous + 1);
    setState(next);
  };

  /** Retour à l'écran de départ : la fenêtre rétrécit, puis reprend sa place dans la colonne. */
  const reset = () => {
    setStarted(false);
    navigate(restartTour());
  };

  /** Départ depuis l'écran d'accueil : la fenêtre s'agrandit et le focus reste dans la démo. */
  const startFromCover = () => {
    onStart();
    stage.current?.focus({ preventScroll: true });
  };

  const sceneProps: SceneProps = { onDone, onStart, onReset: reset, reducedMotion, interacted };

  return (
    <MotionConfig reducedMotion="user">
      <figure
        aria-label="Démonstration interactive du parcours d'une livraison"
        data-started={started ? "true" : "false"}
        className="relative w-full overflow-hidden rounded-[24px] border border-border bg-card p-1.5 shadow-[0_1px_2px_rgba(14,19,16,0.04),0_20px_50px_-30px_rgba(14,19,16,0.25)]"
      >
        <div className="flex items-center gap-3 px-2 py-2 sm:px-3">
          <div className="hidden items-center gap-1.5 sm:flex">
            <button
              type="button"
              onClick={reset}
              aria-label="Fermer la démonstration et revenir au début"
              title="Revenir au début"
              className="h-2.5 w-2.5 rounded-full bg-[#ff5f57] transition-transform hover:scale-125 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1"
            />
            <span className="h-2.5 w-2.5 rounded-full bg-[#febc2e]" aria-hidden />
            <span className="h-2.5 w-2.5 rounded-full bg-[#28c840]" aria-hidden />
          </div>
          <div className="mx-auto flex h-7 min-w-0 max-w-[280px] flex-1 items-center justify-center gap-1.5 overflow-hidden rounded-lg bg-secondary px-3 text-xs font-medium text-muted-foreground">
            <Lock className="h-3 w-3 shrink-0" aria-hidden />
            <AnimatePresence mode="wait" initial={false}>
              <motion.span
                key={started ? step : "cover"}
                initial={{ y: 8, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: -8, opacity: 0 }}
                transition={{ duration: 0.3, ease: EASE_OUT }}
                className="truncate"
              >
                TutelLiv · <span className="text-foreground">{started ? SPACE_LABELS[step] : "Tableau de bord"}</span>
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
          className="relative h-[420px] overflow-hidden rounded-[18px] bg-[#f5f8f6] focus:outline-none sm:h-[460px] lg:h-[600px]"
        >
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={`${showing}-${visit}`}
              className="absolute inset-0"
              initial={{ opacity: 0, scale: 1.02, filter: "blur(6px)" }}
              animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
              exit={{ opacity: 0, scale: 0.98, filter: "blur(6px)" }}
              transition={{ duration: 0.45, ease: EASE_OUT }}
            >
              {interlude ? (
                <InterludeCard interlude={interlude} durationMs={interludeMs} />
              ) : (
                <>
                  {step === "order" && <SceneClientOrder {...sceneProps} />}
                  {step === "dispatch" && <SceneDispatch {...sceneProps} />}
                  {step === "driver" && <SceneDriver {...sceneProps} />}
                  {step === "tracking" && <SceneTracking {...sceneProps} />}
                  {step === "proof" && <SceneProof {...sceneProps} />}
                  {step === "receipt" && <SceneReceipt {...sceneProps} />}
                  {step === "invoices" && <SceneInvoices {...sceneProps} onRestart={reset} />}
                </>
              )}
            </motion.div>
          </AnimatePresence>
          <GuideBubble stage={stage} reducedMotion={reducedMotion} collapsed={leaving} actions={{ start: startFromCover }} />
          <GuideCursor stage={stage} hidden={reducedMotion || interlude !== null} />
          <AnimatePresence>
            {!started && (
              <TourCover key="cover" onStart={startFromCover} />
            )}
          </AnimatePresence>
        </div>

        <ol aria-label="Étapes de la démonstration" className="grid grid-cols-7 gap-1 px-1 pb-0.5 pt-1.5 max-md:flex max-md:gap-0 max-md:overflow-x-auto max-md:px-0">
          {TOUR_STEPS.map((item, index) => {
            const isCurrent = index === state.current;
            const locked = index > state.reached;
            return (
              <li key={item} className="max-md:min-w-11 max-md:flex-1">
                <button
                  type="button"
                  disabled={locked}
                  aria-current={isCurrent ? "step" : undefined}
                  aria-label={`${index + 1}. ${TOUR_STEP_LABELS[item]}`}
                  onClick={() => navigate(goToStep(state, item))}
                  className={cn(
                    "relative flex w-full items-center justify-center gap-1 rounded-lg px-0.5 py-1.5 max-md:min-h-11 text-[11px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transition-none",
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
                  {/* Numéros seuls au repos ; libellés une fois la démo lancée, sur écran large. */}
                  <span className={cn("relative hidden whitespace-nowrap", started && "lg:inline")}>
                    {TOUR_STEP_LABELS[item]}
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
      </figure>
    </MotionConfig>
  );
}
