import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  MANUAL_ACTIONS,
  ANNONA_ACTIONS,
  countYourActions,
  manualAt,
  annonaAt,
} from "../src/features/landing/actions-race";

test("LANDING-3 : avec Annona, une seule action pour vous, « Valider la tournée », en premier", () => {
  const yours = ANNONA_ACTIONS.filter((action) => action.kind === "you");
  assert.deepEqual(yours.map((action) => action.label), ["Valider la tournée"]);
  assert.equal(ANNONA_ACTIONS[0]?.label, "Valider la tournée");
});

test("LANDING-3 : la course se termine sur le temps libéré pour trouver de nouveaux clients", () => {
  const last = ANNONA_ACTIONS.at(-1);
  assert.equal(last?.kind, "free");
  assert.match(last?.label ?? "", /trouver de nouveaux clients/);
});

test("LANDING-3 : compteurs d'actions au fil de la course", () => {
  assert.deepEqual(countYourActions(0), { manual: 0, annona: 0 });
  assert.deepEqual(countYourActions(annonaAt(0)), { manual: 0, annona: 1 });
  // Les actions automatiques ne comptent jamais comme les vôtres.
  assert.equal(countYourActions(annonaAt(ANNONA_ACTIONS.length - 1)).annona, 1);
  assert.deepEqual(countYourActions(manualAt(MANUAL_ACTIONS.length - 1)), { manual: MANUAL_ACTIONS.length, annona: 1 });
  // Annona a fini avant la course à la main.
  assert.ok(annonaAt(ANNONA_ACTIONS.length - 1) < manualAt(MANUAL_ACTIONS.length - 1));
});

test("LANDING-3 : on compte des actions, jamais des minutes ni un gain chiffré inventé", () => {
  for (const label of [...MANUAL_ACTIONS, ...ANNONA_ACTIONS.map((action) => action.label)]) {
    assert.doesNotMatch(label, /\d/, label);
  }
  const home = readFileSync(new URL("../src/features/landing/home-landing.tsx", import.meta.url), "utf8");
  assert.match(home, /<ActionsRace \/>/);
  // Ordre retenu par le propriétaire : haut de page, course, puis mini-démo ; même barre que les autres pages.
  assert.match(home, /<PublicTopNavbar \/>/);
  assert.ok(home.indexOf("<ActionsRace />") < home.indexOf("<LandingDemo />"));
  assert.match(home, /Toute votre société de coursiers/);
});
