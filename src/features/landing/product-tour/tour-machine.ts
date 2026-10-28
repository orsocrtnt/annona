/** Parcours imposé de la mini-démo du hero : de la commande du client au suivi des paiements. */
export type TourStep = "order" | "dispatch" | "driver" | "tracking" | "proof" | "receipt" | "invoices";

export const TOUR_STEPS: readonly TourStep[] = ["order", "dispatch", "driver", "tracking", "proof", "receipt", "invoices"];

export const TOUR_STEP_LABELS: Record<TourStep, string> = {
  order: "Commande",
  dispatch: "Dispatch",
  driver: "Livreur",
  tracking: "Suivi",
  proof: "Preuve",
  receipt: "Facture",
  invoices: "Paiements",
};

/** `reached` = étape la plus avancée déjà atteinte ; on peut y revenir, jamais la dépasser. */
export type TourState = { current: number; reached: number };

export function initialTourState(): TourState {
  return { current: 0, reached: 0 };
}

/** N'avance que si le geste vient de l'étape affichée (un double clic reste sans effet). */
export function advanceTour(state: TourState, from: TourStep): TourState {
  const index = TOUR_STEPS.indexOf(from);
  if (index !== state.current || index >= TOUR_STEPS.length - 1) return state;
  const current = index + 1;
  return { current, reached: Math.max(state.reached, current) };
}

export function goToStep(state: TourState, step: TourStep): TourState {
  const index = TOUR_STEPS.indexOf(step);
  if (index < 0 || index > state.reached) return state;
  return { ...state, current: index };
}

export function restartTour(): TourState {
  return initialTourState();
}

/** Sous-étapes du dispatch : la file avant le clic, la répartition, puis le résultat. */
export type DispatchPhase = "before" | "during" | "after";

/** Sous-étapes affichées : la répartition et son résultat se lisent ensemble sous « Après ». */
export const DISPATCH_STEP_LABELS = ["Avant", "Après"] as const;

export function dispatchStepIndex(phase: DispatchPhase): number {
  return phase === "before" ? 0 : 1;
}

export function dispatchPhase(launched: boolean, placed: number, total: number): DispatchPhase {
  if (!launched) return "before";
  return placed >= total ? "after" : "during";
}
