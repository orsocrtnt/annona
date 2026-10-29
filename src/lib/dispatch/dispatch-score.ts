import type { DispatchProximityStatus } from "@/lib/dispatch/dispatch-proximity";
import { TRAVEL_FALLBACK_LABELS, type TravelEstimate } from "@/lib/dispatch/travel-time";

/**
 * DISPATCH-4 — score d'affectation explicable (0 à 100), calculé sur les livreurs déjà
 * éligibles (règles dures et plafonds de charge respectés). Poids documentés :
 *
 * - trajet jusqu'au retrait : 50 % — 0 min = 1, 45 min ou plus = 0, linéaire ; trajet inconnu :
 *   GPS non utilisé ou retrait sans coordonnées = 0,5 (personne n'a d'information : neutre) ;
 *   en service mais position absente ou trop ancienne = 0,25 (jamais exclu, comme dans DEMO-3,
 *   mais pas favorisé face à un livreur localisé) ; hors service = 0 (ne travaille pas) ;
 * - charge : 30 % — part libre de son plafond (aucune livraison = 1, plafond atteint = 0) ;
 * - zone : 10 % — livreur attitré de la zone = 1, zone couverte par sa règle = 0,75, sans
 *   restriction de zone = 0,5 ;
 * - priorité réglée : 10 % — 1/priorité (priorité 1 = 1), sans règle = 0.
 *
 * À score égal : trajet le plus court, puis charge la plus faible, puis ordre stable (id).
 */
export const DISPATCH_SCORE_WEIGHTS = { travel: 0.5, load: 0.3, zone: 0.1, priority: 0.1 } as const;
export const TRAVEL_SCORE_HORIZON_SECONDS = 45 * 60;
export const DISPATCH_SUGGESTION_COUNT = 3;

/** Raison recopiée dans l'historique visible du client : aucun chiffre ni position. */
export const BEST_SCORE_HISTORY_REASON = "Meilleur score (trajet, charge, zone)";
export const SUGGESTION_HISTORY_REASON = "Suggestion validée par le dispatch";

export type ScoreZoneMatch = "PREFERRED" | "COVERED" | "ANY";

export type ScoreCandidate = {
  id: string;
  load: number;
  maxLoad: number;
  priority: number | null;
  zone: ScoreZoneMatch;
  zoneName: string | null;
  travel: TravelEstimate | null;
  positionStatus: DispatchProximityStatus;
};

export type RankedCandidate = ScoreCandidate & {
  rank: number;
  score: number;
  explanation: string;
};

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

const POSITION_LABELS: Partial<Record<DispatchProximityStatus, string>> = {
  OFF_DUTY: "hors service",
  STALE: "position trop ancienne",
  NO_POSITION: "aucune position",
  NO_PICKUP: "retrait sans coordonnées",
  DISABLED: "GPS non utilisé",
};

const UNKNOWN_TRAVEL_SCORES: Partial<Record<DispatchProximityStatus, number>> = {
  DISABLED: 0.5,
  NO_PICKUP: 0.5,
  NO_POSITION: 0.25,
  STALE: 0.25,
  OFF_DUTY: 0,
};

export function travelScore(travel: TravelEstimate | null, positionStatus: DispatchProximityStatus = "NO_POSITION"): number {
  if (!travel) return UNKNOWN_TRAVEL_SCORES[positionStatus] ?? 0.25;
  return clamp01(1 - travel.seconds / TRAVEL_SCORE_HORIZON_SECONDS);
}

export function loadScore(load: number, maxLoad: number): number {
  return maxLoad > 0 ? clamp01(1 - load / maxLoad) : 0;
}

const ZONE_SCORES: Record<ScoreZoneMatch, number> = { PREFERRED: 1, COVERED: 0.75, ANY: 0.5 };

export function priorityScore(priority: number | null): number {
  return priority && priority >= 1 ? 1 / priority : 0;
}

export function scoreCandidate(candidate: ScoreCandidate): number {
  const w = DISPATCH_SCORE_WEIGHTS;
  const total =
    w.travel * travelScore(candidate.travel, candidate.positionStatus) +
    w.load * loadScore(candidate.load, candidate.maxLoad) +
    w.zone * ZONE_SCORES[candidate.zone] +
    w.priority * priorityScore(candidate.priority);
  return Math.round(total * 100);
}

export function formatTravelMinutes(seconds: number): string {
  return seconds < 60 ? "moins d'une minute" : `${Math.round(seconds / 60)} min`;
}

/** « Pourquoi ce livreur » en une phrase, pour le dispatcher uniquement. */
export function explainCandidate(candidate: ScoreCandidate): string {
  const parts: string[] = [];
  const travel = candidate.travel;
  if (travel?.source === "ROUTE") {
    parts.push(`retrait à ${formatTravelMinutes(travel.seconds)} (trajet routier)`);
  } else if (travel) {
    parts.push(
      `retrait à environ ${formatTravelMinutes(travel.seconds)} à vol d'oiseau (${TRAVEL_FALLBACK_LABELS[travel.fallbackReason]})`
    );
  } else {
    parts.push(`trajet inconnu (${POSITION_LABELS[candidate.positionStatus] ?? "aucune position"})`);
  }
  parts.push(
    candidate.load === 0
      ? "aucune livraison en cours"
      : `${candidate.load} livraison${candidate.load > 1 ? "s" : ""} en cours sur ${candidate.maxLoad}`
  );
  if (candidate.zone === "PREFERRED") parts.push(`attitré à la zone « ${candidate.zoneName ?? "—"} »`);
  else if (candidate.zone === "COVERED") parts.push("couvre la zone de la livraison");
  if (candidate.priority) parts.push(`priorité ${candidate.priority}`);
  const sentence = parts.join(", ");
  return `${sentence.charAt(0).toUpperCase()}${sentence.slice(1)}.`;
}

/** Ordre total et transitif : score, trajet connu le plus court, charge, id. */
export function rankDispatchCandidates(candidates: ScoreCandidate[]): RankedCandidate[] {
  return candidates
    .map((candidate) => ({ candidate, score: scoreCandidate(candidate) }))
    .sort(
      (a, b) =>
        b.score - a.score ||
        (a.candidate.travel?.seconds ?? Number.POSITIVE_INFINITY) -
          (b.candidate.travel?.seconds ?? Number.POSITIVE_INFINITY) ||
        a.candidate.load - b.candidate.load ||
        a.candidate.id.localeCompare(b.candidate.id)
    )
    .map(({ candidate, score }, index) => ({
      ...candidate,
      rank: index + 1,
      score,
      explanation: explainCandidate(candidate),
    }));
}
