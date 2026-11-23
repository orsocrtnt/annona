import { improveOpenPath } from "@/lib/dispatch/round-improve";
import type { GeoPoint } from "@/lib/dispatch/travel-time";

/**
 * DISPATCH-OPTIM (RG-09, ADM-06) — tournées de taille voisine pour un même créneau. Module pur.
 *
 * Le calcul par insertion remplit une tournée jusqu'au bout du créneau avant d'ouvrir la suivante (99 et 41 arrêts
 * pour 140 commandes) : la grande serpente et finit tard. À nombre de tournées égal, des tournées de même taille,
 * chacune sur son secteur, sont plus courtes au total et finissent plus tôt (mesuré le 23 novembre 2026 : 4 à 11 %
 * de route en moins, fin 1 à 2 h plus tôt).
 *
 * Méthode : (1) secteurs autour du laboratoire — commerces triés par direction, découpés en `count` parts égales,
 * pour plusieurs points de départ du découpage ; chaque part est ordonnée (`improveOpenPath`) et le découpage le plus
 * court est gardé ; (2) retouche — un commerce passe d'une tournée à une autre si la route totale baisse et que les
 * tailles restent dans la tolérance ; (3) chaque tournée est réordonnée. Les limites (créneau, arrêts, durée) sont
 * vérifiées par l'appelant, qui garde son calcul si le résultat ne les respecte pas ou n'est pas plus court.
 */

/** Écart de taille admis autour de la moyenne lors de la retouche (15 % : 70 arrêts → de 60 à 81). */
export const BALANCE_TOLERANCE = 0.15;
/** Nombre de points de départ essayés pour le découpage en secteurs. */
const SWEEP_STARTS = 20;
const MAX_PASSES = 20;
const EPSILON = 1e-6;

function pathSeconds(start: GeoPoint, route: readonly number[], points: readonly GeoPoint[], travel: (from: GeoPoint, to: GeoPoint) => number) {
  let total = 0;
  let position = start;
  for (const index of route) {
    total += travel(position, points[index]!);
    position = points[index]!;
  }
  return total;
}

function ordered(start: GeoPoint, group: readonly number[], points: readonly GeoPoint[], travel: (from: GeoPoint, to: GeoPoint) => number) {
  return improveOpenPath(start, group.map((index) => points[index]!), travel).map((position) => group[position]!);
}

/**
 * Répartit `points` en `count` tournées de taille voisine, chacune dans l'ordre de passage (indices dans `points`).
 * Déterministe : mêmes entrées, même résultat.
 */
export function balanceRounds(
  start: GeoPoint,
  points: readonly GeoPoint[],
  count: number,
  travelSeconds: (from: GeoPoint, to: GeoPoint) => number
): number[][] {
  const total = points.length;
  if (count <= 1 || total <= count) {
    return count <= 1 ? [ordered(start, points.map((_, index) => index), points, travelSeconds)] : points.map((_, index) => [index]);
  }
  const travel = travelSeconds;

  // (1) Secteurs : direction de chaque commerce vu du laboratoire (longitude corrigée de la latitude).
  const scale = Math.cos((start.latitude * Math.PI) / 180);
  const angle = (point: GeoPoint) => Math.atan2(point.latitude - start.latitude, (point.longitude - start.longitude) * scale);
  const byAngle = points.map((point, index) => ({ index, angle: angle(point) })).sort((a, b) => a.angle - b.angle || a.index - b.index).map((item) => item.index);
  const step = Math.max(1, Math.floor(total / SWEEP_STARTS));
  let best: number[][] = [];
  let bestSeconds = Number.POSITIVE_INFINITY;
  for (let shift = 0; shift < total; shift += step) {
    const rotated = [...byAngle.slice(shift), ...byAngle.slice(0, shift)];
    const groups = Array.from({ length: count }, (_, group) =>
      ordered(start, rotated.slice(Math.floor((group * total) / count), Math.floor(((group + 1) * total) / count)), points, travel)
    );
    const seconds = groups.reduce((sum, group) => sum + pathSeconds(start, group, points, travel), 0);
    if (seconds < bestSeconds - EPSILON) {
      bestSeconds = seconds;
      best = groups;
    }
  }

  // (2) Retouche : déplacer un commerce vers la meilleure place d'une autre tournée.
  const average = total / count;
  const minSize = Math.max(1, Math.floor(average * (1 - BALANCE_TOLERANCE)));
  const maxSize = Math.ceil(average * (1 + BALANCE_TOLERANCE));
  const cost = (from: number, to: number) => travel(points[from]!, points[to]!);
  const fromStart = (to: number) => travel(start, points[to]!);
  const link = (from: number | undefined, to: number) => (from === undefined ? fromStart(to) : cost(from, to));

  for (let pass = 0; pass < MAX_PASSES; pass += 1) {
    let moved = false;
    for (let source = 0; source < count; source += 1) {
      for (let position = 0; position < best[source]!.length; position += 1) {
        const route = best[source]!;
        if (route.length <= minSize) break;
        const point = route[position]!;
        const before = route[position - 1];
        const after = route[position + 1];
        const removal = link(before, point) + (after === undefined ? 0 : cost(point, after) - link(before, after));
        let target = -1;
        let at = -1;
        let gain = EPSILON;
        for (let other = 0; other < count; other += 1) {
          if (other === source || best[other]!.length >= maxSize) continue;
          const candidate = best[other]!;
          for (let slot = 0; slot <= candidate.length; slot += 1) {
            const left = candidate[slot - 1];
            const right = candidate[slot];
            const insertion = link(left, point) + (right === undefined ? 0 : cost(point, right) - link(left, right));
            if (removal - insertion > gain) {
              gain = removal - insertion;
              target = other;
              at = slot;
            }
          }
        }
        if (target >= 0) {
          best[source] = [...route.slice(0, position), ...route.slice(position + 1)];
          best[target] = [...best[target]!.slice(0, at), point, ...best[target]!.slice(at)];
          position -= 1;
          moved = true;
        }
      }
    }
    // (3) Réordonner après chaque passe.
    best = best.map((group) => ordered(start, group, points, travel));
    if (!moved) break;
  }
  return best;
}
