/**
 * Qualité du calcul des tournées (RG-09, ADM-06) : à quelle distance de la meilleure tournée est-on ?
 *
 * Le calcul (`planRounds` via `planSlotRounds` et `orderRoundStops`) est une insertion au moindre coût, sans
 * amélioration ensuite. Ces tests le mesurent sur des adresses de Paris (rues de la démo, tirage fixe) avec les
 * temps à vol d'oiseau (30 km/h, détour de 40 %), départ du laboratoire de la démo (rue de la Roquette).
 *
 * - Tests ordinaires : garde-fous qui passent aujourd'hui (écart à l'optimum exact borné, temps de calcul,
 *   toutes les commandes placées dans le créneau).
 * - Tests `todo` : défauts mesurés le 23 novembre 2026, qui échouent tant que le calcul n'est pas amélioré
 *   (ils n'empêchent pas `npm test` de passer). Voir la tâche DISPATCH-OPTIM de `TODO.md`.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { orderRoundStops, planSlotRounds, ROUND_MAX_STOPS } from "../src/domains/order/round-generation";
import { DEMO_STREETS_NORTH, DEMO_STREETS_SOUTH } from "../src/domains/demo/demo-scenario-data";
import { createTravelTimeState, estimateTravelMatrix, ROUTE_MATRIX_MAX_POINTS, straightLineSeconds, type GeoPoint } from "../src/lib/dispatch/travel-time";

const DEPOT: GeoPoint = { latitude: 48.8547, longitude: 2.3725 };
const travel = straightLineSeconds;
// Créneau du matin 5h30-12h30 heure de Paris, en hiver (UTC+1).
const WINDOW_START = Date.UTC(2026, 10, 24, 4, 30);
const WINDOW_END = Date.UTC(2026, 10, 24, 11, 30);

function random(seed: number) {
  let state = seed >>> 0;
  return () => (state = (state * 1_664_525 + 1_013_904_223) >>> 0) / 2 ** 32;
}

/** Commerces tirés autour des rues de la démo (nord et sud de Paris), à environ 200 m près. */
function parisPoints(count: number, seed: number): GeoPoint[] {
  const next = random(seed);
  const streets = [...DEMO_STREETS_NORTH, ...DEMO_STREETS_SOUTH];
  return Array.from({ length: count }, () => {
    const street = streets[Math.floor(next() * streets.length)]!;
    return { latitude: street[2] + (next() - 0.5) * 0.004, longitude: street[3] + (next() - 0.5) * 0.006 };
  });
}

const stopsOf = (points: GeoPoint[], prefix = "o") => points.map((point, index) => ({ id: `${prefix}${String(index).padStart(3, "0")}`, point, label: "" }));

function drivingSeconds(route: GeoPoint[]) {
  let total = 0;
  let position = DEPOT;
  for (const point of route) {
    total += travel(position, point);
    position = point;
  }
  return total;
}

function orderedPoints(points: GeoPoint[], ids: string[]) {
  return ids.map((id) => points[Number(id.slice(1))]!);
}

/** Meilleur ordre exact (toutes les permutations), chemin ouvert depuis le laboratoire. */
function optimalSeconds(points: GeoPoint[]) {
  let best = Number.POSITIVE_INFINITY;
  const used = new Array(points.length).fill(false);
  const walk = (position: GeoPoint, depth: number, sum: number) => {
    if (sum >= best) return;
    if (depth === points.length) {
      best = sum;
      return;
    }
    points.forEach((point, index) => {
      if (used[index]) return;
      used[index] = true;
      walk(point, depth + 1, sum + travel(position, point));
      used[index] = false;
    });
  };
  walk(DEPOT, 0, 0);
  return best;
}

/** 2-opt classique sur le chemin ouvert : retourne le trajet amélioré (secondes de route). */
function twoOptSeconds(route: GeoPoint[]) {
  const path = [DEPOT, ...route];
  let improved = true;
  while (improved) {
    improved = false;
    for (let i = 1; i < path.length - 1; i += 1) {
      for (let k = i + 1; k < path.length; k += 1) {
        const before = travel(path[i - 1]!, path[i]!) + (k + 1 < path.length ? travel(path[k]!, path[k + 1]!) : 0);
        const after = travel(path[i - 1]!, path[k]!) + (k + 1 < path.length ? travel(path[i]!, path[k + 1]!) : 0);
        if (after < before - 0.5) {
          path.splice(i, k - i + 1, ...path.slice(i, k + 1).reverse());
          improved = true;
        }
      }
    }
  }
  return drivingSeconds(path.slice(1));
}

const average = (values: number[]) => values.reduce((sum, value) => sum + value, 0) / values.length;

test("RG-09, ADM-06 : sur 7 arrêts, l'ordre calculé reste proche de l'optimum exact (écart moyen < 8 %)", () => {
  const gaps = Array.from({ length: 40 }, (_, index) => {
    const points = parisPoints(7, index + 1);
    const ids = orderRoundStops({ start: DEPOT, stops: stopsOf(points), travelSeconds: travel });
    return drivingSeconds(orderedPoints(points, ids)) / optimalSeconds(points) - 1;
  });
  // Mesuré le 23 novembre 2026 : moyenne 4,6 %, pire cas 27 % (sur 150 cas de 8 arrêts), optimum trouvé une fois sur trois.
  assert.ok(average(gaps) < 0.08, `écart moyen ${(average(gaps) * 100).toFixed(1)} %`);
  assert.ok(Math.max(...gaps) < 0.35, `pire écart ${(Math.max(...gaps) * 100).toFixed(1)} %`);
});

test("RG-09 : un créneau de 140 commandes est calculé en moins de 2 s, chaque commande une seule fois, dans le créneau", () => {
  const points = parisPoints(140, 140);
  const startedAt = performance.now();
  const rounds = planSlotRounds({ orders: stopsOf(points), depot: DEPOT, windowStart: WINDOW_START, windowEnd: WINDOW_END, travelSeconds: travel });
  const elapsed = performance.now() - startedAt;
  assert.ok(elapsed < 2000, `${elapsed.toFixed(0)} ms`);
  const placed = rounds.flatMap((round) => round.orderIds);
  assert.equal(placed.length, 140);
  assert.equal(new Set(placed).size, 140);
  for (const round of rounds) {
    assert.ok(round.orderIds.length <= ROUND_MAX_STOPS);
    for (const arrival of round.arrivals) assert.ok(arrival !== null && arrival <= WINDOW_END);
  }
});

test(
  "à améliorer : une tournée de 65 arrêts ne se raccourcit plus de 2 % par un simple 2-opt",
  { todo: "mesuré le 23 novembre 2026 : 4,6 % de route en moins en moyenne, jusqu'à 9 %" },
  () => {
    const gains = Array.from({ length: 10 }, (_, index) => {
      const points = parisPoints(65, (index + 1) * 7);
      const route = orderedPoints(points, orderRoundStops({ start: DEPOT, stops: stopsOf(points), travelSeconds: travel }));
      return 1 - twoOptSeconds(route) / drivingSeconds(route);
    });
    assert.ok(average(gains) < 0.02, `gain moyen d'un 2-opt : ${(average(gains) * 100).toFixed(1)} %`);
  }
);

test(
  "à améliorer : les mêmes adresses donnent la même longueur de tournée, quels que soient les identifiants des commandes",
  { todo: "mesuré le 23 novembre 2026 : de 121 à 138 min de route pour les mêmes 65 adresses (ordre d'insertion = ordre des identifiants)" },
  () => {
    const points = parisPoints(65, 99);
    const lengths = Array.from({ length: 12 }, (_, draw) => {
      const next = random(draw + 1);
      const shuffled = points.map((point) => ({ point, key: next() })).sort((a, b) => a.key - b.key).map((item) => item.point);
      return drivingSeconds(orderedPoints(shuffled, orderRoundStops({ start: DEPOT, stops: stopsOf(shuffled), travelSeconds: travel })));
    });
    assert.ok(Math.max(...lengths) / Math.min(...lengths) - 1 < 0.02, `écart ${((Math.max(...lengths) / Math.min(...lengths) - 1) * 100).toFixed(1)} %`);
  }
);

test(
  "à décider avec Théo : 140 commandes du matin se répartissent en tournées de taille voisine",
  { todo: "mesuré le 23 novembre 2026 : 92 et 48 arrêts ; la grande finit à 12h28 pour un créneau qui ferme à 12h30, l'autre à 9h45" },
  () => {
    const rounds = planSlotRounds({ orders: stopsOf(parisPoints(140, 140)), depot: DEPOT, windowStart: WINDOW_START, windowEnd: WINDOW_END, travelSeconds: travel });
    const sizes = rounds.map((round) => round.orderIds.length);
    assert.ok(Math.max(...sizes) - Math.min(...sizes) <= 20, `tailles ${sizes.join(" / ")}`);
  }
);

test(
  "à améliorer : une journée réelle (plus de 60 commerces) obtient les temps de trajet routiers",
  { todo: `au-delà de ${ROUTE_MATRIX_MAX_POINTS} points, la matrice n'est pas demandée : 60 à 70 arrêts par tournée suffisent à tout calculer à vol d'oiseau` },
  async () => {
    let calls = 0;
    const matrix = await estimateTravelMatrix([DEPOT, ...parisPoints(86, 5)], {
      baseUrl: "https://osrm.test",
      state: createTravelTimeState(),
      fetchImpl: async () => {
        calls += 1;
        return { ok: true, status: 200, json: async () => ({ code: "Ok", durations: [] }) };
      },
    });
    assert.equal(calls > 0 && !matrix.approximate, true, "matrice routière jamais demandée");
  }
);
