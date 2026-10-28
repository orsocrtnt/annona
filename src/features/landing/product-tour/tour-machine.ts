/** Parcours imposé de la mini-démo du hero : client → dispatch → livreur → suivi. */
export type TourStep = "order" | "dispatch" | "driver" | "tracking";

export const TOUR_STEPS: readonly TourStep[] = ["order", "dispatch", "driver", "tracking"];

export const TOUR_STEP_LABELS: Record<TourStep, string> = {
  order: "Client",
  dispatch: "Admin",
  driver: "Livreur",
  tracking: "Suivi",
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
