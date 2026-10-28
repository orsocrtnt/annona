import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import test from "node:test";
import {
  advanceTour,
  goToStep,
  initialTourState,
  restartTour,
} from "../src/features/landing/product-tour/tour-machine";
import { TOUR_DRIVERS, interludeFor } from "../src/features/landing/product-tour/tour-data";
import { TOUR_ROUTE, pointAlongRoute } from "../src/features/landing/product-tour/city-route";
import { typingDelays } from "../src/features/landing/product-tour/typing";

test("la démo avance d'une étape par geste", () => {
  assert.deepEqual(advanceTour(initialTourState(), "order"), { current: 1, reached: 1 });
});

test("un double geste n'avance qu'une seule fois", () => {
  const once = advanceTour(initialTourState(), "order");
  assert.deepEqual(advanceTour(once, "order"), { current: 1, reached: 1 });
});

test("la dernière étape ne va pas plus loin", () => {
  const last = { current: 3, reached: 3 };
  assert.deepEqual(advanceTour(last, "tracking"), last);
});

test("on revient sur une étape vue sans perdre la progression", () => {
  const back = goToStep({ current: 2, reached: 2 }, "order");
  assert.deepEqual(back, { current: 0, reached: 2 });
  assert.deepEqual(goToStep(back, "driver"), { current: 2, reached: 2 });
});

test("on ne saute pas vers une étape future", () => {
  assert.deepEqual(goToStep(initialTourState(), "dispatch"), initialTourState());
});

test("rejouer un geste passé garde l'étape la plus avancée", () => {
  assert.deepEqual(advanceTour({ current: 0, reached: 2 }, "order"), { current: 1, reached: 2 });
});

test("rejouer remet la démo au début", () => {
  assert.deepEqual(restartTour(), { current: 0, reached: 0 });
});

test("le dispatcher retient un seul livreur : Karim", () => {
  const chosen = TOUR_DRIVERS.filter((driver) => driver.verdict === "chosen");
  assert.equal(chosen.length, 1);
  assert.equal(chosen[0]?.name, "Karim");
});

test("le hero affiche la mini-démo à la place de la capture du tableau de bord", () => {
  const home = readFileSync(fileURLToPath(new URL("../src/features/landing/home-landing.tsx", import.meta.url)), "utf8");
  assert.match(home, /<ProductTour \/>/);
  assert.doesNotMatch(home, /produit-tableau-de-bord\.webp/);
  assert.match(home, /produit-carte\.webp/);
});

test("le marqueur suit le trajet selon la distance parcourue", () => {
  const route = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }];
  assert.deepEqual(pointAlongRoute(route, 0), { x: 0, y: 0 });
  assert.deepEqual(pointAlongRoute(route, 0.25), { x: 5, y: 0 });
  assert.deepEqual(pointAlongRoute(route, 0.5), { x: 10, y: 0 });
  assert.deepEqual(pointAlongRoute(route, 1), { x: 10, y: 10 });
});

test("le marqueur reste aux extrémités hors de [0, 1]", () => {
  const route = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }];
  assert.deepEqual(pointAlongRoute(route, -1), { x: 0, y: 0 });
  assert.deepEqual(pointAlongRoute(route, 2), { x: 10, y: 10 });
});

test("un trajet d'un seul point garde le marqueur sur ce point", () => {
  assert.deepEqual(pointAlongRoute([{ x: 3, y: 4 }], 0.5), { x: 3, y: 4 });
});

test("le trajet de la démo suit plusieurs rues", () => {
  assert.ok(TOUR_ROUTE.length >= 5);
});

test("la fin de la démo renvoie vers la démonstration complète", () => {
  const scene = readFileSync(fileURLToPath(new URL("../src/features/landing/product-tour/scene-tracking.tsx", import.meta.url)), "utf8");
  assert.match(scene, /href="\/demonstration"/);
  assert.match(scene, /Rejouer/);
});

test("chaque changement d'espace par un geste annonce l'espace suivant", () => {
  assert.match(interludeFor("order", "dispatch")?.title ?? "", /côté entreprise/);
  assert.match(interludeFor("dispatch", "driver")?.title ?? "", /Côté livreur/);
  assert.match(interludeFor("driver", "tracking")?.title ?? "", /Retour côté client/);
});

test("aucun carton sans changement d'étape ou en revenant en arrière", () => {
  assert.equal(interludeFor("dispatch", "dispatch"), null);
  assert.equal(interludeFor("tracking", "order"), null);
});

test("la frappe donne un délai par caractère, entre 45 et 130 ms", () => {
  const delays = typingDelays("18 rue de la Roquette", 7);
  assert.equal(delays.length, "18 rue de la Roquette".length);
  assert.ok(delays.every((delay) => delay >= 45 && delay <= 130));
});

test("la frappe marque une pause après un espace", () => {
  const delays = typingDelays("ab cd", 3);
  assert.ok((delays[3] ?? 0) >= 105);
  assert.ok((delays[1] ?? 0) <= 70);
});

test("la frappe est identique pour une même graine", () => {
  assert.deepEqual(typingDelays("Ivry-sur-Seine", 5), typingDelays("Ivry-sur-Seine", 5));
});
