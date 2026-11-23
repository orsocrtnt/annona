/**
 * DISPATCH-OPTIM (RG-09, ADM-06) — amélioration d'une tournée après l'insertion au moindre coût. Module pur.
 *
 * Chemin ouvert : part de `start` (laboratoire, dernier arrêt livré) et finit au dernier arrêt, sans retour.
 * Deux mouvements classiques, répétés tant qu'ils raccourcissent le trajet :
 * - 2-opt : retourner une portion de la tournée (supprime les trajets qui se croisent) ;
 * - Or-opt : déplacer un groupe de 1 à 3 arrêts consécutifs ailleurs dans la tournée.
 * Les temps peuvent être asymétriques (matrice routière) : le coût d'une portion retournée est recalculé dans
 * son nouveau sens. Sans `start`, le premier arrêt est libre (trajet de départ compté zéro).
 * Coût : n² mouvements par passe, chacun en temps constant ; passes bornées par `MAX_PASSES`.
 */

const MAX_PASSES = 50;
const MAX_SEGMENT = 3;
/** Gain minimal en secondes : évite de boucler sur des égalités d'arrondi. */
const EPSILON = 1e-6;

/** Ordre amélioré, sous forme d'indices dans `points`. Ne rallonge jamais le trajet. */
export function improveOpenPath<P>(start: P | null, points: readonly P[], travelSeconds: (from: P, to: P) => number): number[] {
  const count = points.length;
  if (count < 2) return points.map((_, index) => index);

  // Nœud 0 = départ ; nœud i + 1 = points[i]. Matrice calculée une fois.
  const size = count + 1;
  const matrix = new Float64Array(size * size);
  for (let from = 0; from < size; from += 1) {
    for (let to = 1; to < size; to += 1) {
      if (from === to) continue;
      matrix[from * size + to] = from === 0 ? (start === null ? 0 : travelSeconds(start, points[to - 1]!)) : travelSeconds(points[from - 1]!, points[to - 1]!);
    }
  }
  const cost = (from: number, to: number) => matrix[from * size + to]!;

  let route = Array.from({ length: size }, (_, index) => index);
  // forward[i] : trajet de route[0] à route[i] ; backward[i] : même portion parcourue à l'envers.
  const forward = new Float64Array(size);
  const backward = new Float64Array(size);
  const refresh = () => {
    for (let index = 1; index < size; index += 1) {
      forward[index] = forward[index - 1]! + cost(route[index - 1]!, route[index]!);
      backward[index] = backward[index - 1]! + cost(route[index]!, route[index - 1]!);
    }
  };
  refresh();

  for (let pass = 0; pass < MAX_PASSES; pass += 1) {
    let improved = false;

    // 2-opt : retourner route[i..k].
    for (let i = 1; i < size - 1; i += 1) {
      for (let k = i + 1; k < size; k += 1) {
        const before = route[i - 1]!;
        const first = route[i]!;
        const last = route[k]!;
        const after = k + 1 < size ? route[k + 1]! : -1;
        const oldCost = cost(before, first) + (forward[k]! - forward[i]!) + (after >= 0 ? cost(last, after) : 0);
        const newCost = cost(before, last) + (backward[k]! - backward[i]!) + (after >= 0 ? cost(first, after) : 0);
        if (newCost < oldCost - EPSILON) {
          route = [...route.slice(0, i), ...route.slice(i, k + 1).reverse(), ...route.slice(k + 1)];
          refresh();
          improved = true;
        }
      }
    }

    // Or-opt : déplacer route[i..i+length-1] (même sens) entre deux autres arrêts.
    for (let length = 1; length <= MAX_SEGMENT; length += 1) {
      for (let i = 1; i + length <= size; i += 1) {
        const before = route[i - 1]!;
        const first = route[i]!;
        const last = route[i + length - 1]!;
        const after = i + length < size ? route[i + length]! : -1;
        const removed = cost(before, first) + (after >= 0 ? cost(last, after) - cost(before, after) : 0);
        const rest = [...route.slice(0, i), ...route.slice(i + length)];
        let bestAt = -1;
        let bestGain = EPSILON;
        for (let at = 0; at < rest.length; at += 1) {
          if (at === i - 1) continue; // place d'origine
          const left = rest[at]!;
          const right = at + 1 < rest.length ? rest[at + 1]! : -1;
          const added = cost(left, first) + (right >= 0 ? cost(last, right) - cost(left, right) : 0);
          if (removed - added > bestGain) {
            bestGain = removed - added;
            bestAt = at;
          }
        }
        if (bestAt >= 0) {
          route = [...rest.slice(0, bestAt + 1), ...route.slice(i, i + length), ...rest.slice(bestAt + 1)];
          refresh();
          improved = true;
        }
      }
    }

    if (!improved) break;
  }
  return route.slice(1).map((node) => node - 1);
}
