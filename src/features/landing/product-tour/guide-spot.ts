/** Coin de l'emplacement où la bulle-guide se pose : t/b = haut/bas, l/r = gauche/droite, c = centrée dessus. */
export type GuideCorner = "tl" | "tr" | "bl" | "br" | "c";

export type GuideLine = { text: string; delay?: number };

type Box = { left: number; top: number; right: number; bottom: number };
type Point = { x: number; y: number };

/** Point d'ancrage de la bulle, relatif à la scène. */
export function spotPoint(box: Box, frame: { left: number; top: number }, corner: GuideCorner): Point {
  if (corner === "c") {
    return { x: Math.round((box.left + box.right) / 2 - frame.left), y: Math.round((box.top + box.bottom) / 2 - frame.top) };
  }
  return {
    x: Math.round((corner.endsWith("r") ? box.right : box.left) - frame.left),
    y: Math.round((corner.startsWith("b") ? box.bottom : box.top) - frame.top),
  };
}

/** Direction du trajet en degrés (0 = vers la droite, 90 = vers le bas) : la goutte s'étire dans ce sens. */
export function travelHeading(from: Point, to: Point): number {
  if (from.x === to.x && from.y === to.y) return 0;
  return Math.round((Math.atan2(to.y - from.y, to.x - from.x) * 180) / Math.PI);
}

/**
 * `action` : la bulle ouverte devient un bouton (écran d'accueil) qui déclenche cette action.
 * `slow` : la goutte rejoint cet emplacement deux fois plus lentement (fin du parcours).
 */
export type GuidePlace = {
  id: string;
  corner: GuideCorner;
  x: number;
  y: number;
  width: number;
  lines: GuideLine[];
  action?: string;
  slow?: boolean;
};
/** Ouverte : bulle avec son texte. Goutte : rétractée, au repos ou en vol. */
export type GuideState = { mode: "drop" | "open"; place: GuidePlace | null; heading: number; trip: number };

/** La goutte rejoint `target` ; un nouvel emplacement compte comme un nouveau trajet. */
export function guideTravel(state: GuideState, target: GuidePlace): GuideState {
  const elsewhere = state.place !== null && state.place.id !== target.id;
  return {
    mode: "drop",
    place: target,
    heading: elsewhere && state.place ? travelHeading(state.place, target) : state.heading,
    trip: elsewhere ? state.trip + 1 : state.trip,
  };
}

/**
 * Réaction immédiate à l'emplacement courant : la bulle ne disparaît jamais.
 * Ouverte au même endroit, elle suit son texte ; ouverte ailleurs, elle se rétracte d'abord sur place ;
 * déjà en goutte, elle part tout de suite ; sans emplacement (entre deux étapes), elle se rétracte sur place et attend.
 */
export function guideOnTarget(state: GuideState, target: GuidePlace | null): GuideState {
  if (!target) return state.mode === "open" ? { ...state, mode: "drop" } : state;
  if (!state.place) return { ...state, mode: "drop", place: target };
  if (state.mode === "open") return state.place.id === target.id ? { ...state, place: target } : { ...state, mode: "drop" };
  return guideTravel(state, target);
}

/** Arrivée : la goutte s'ouvre en bulle s'il y a quelque chose à dire, sinon elle reste posée. */
export function guideOpen(state: GuideState, target: GuidePlace): GuideState {
  return { ...guideTravel(state, target), mode: target.lines.length > 0 ? "open" : "drop" };
}
