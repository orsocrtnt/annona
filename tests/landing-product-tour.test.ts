import assert from "node:assert/strict";
import test from "node:test";
import {
  advanceTour,
  goToStep,
  initialTourState,
  restartTour,
} from "../src/features/landing/product-tour/tour-machine";
import { TOUR_DRIVERS } from "../src/features/landing/product-tour/tour-data";

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
