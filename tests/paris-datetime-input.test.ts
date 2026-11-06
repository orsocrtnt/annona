import assert from "node:assert/strict";
import test from "node:test";
import { fromParisDateTimeInput, toParisDateTimeInput } from "../src/lib/format/paris-datetime-input";

test("AUDIT-0411 : le champ affiche l'heure de Paris, en hiver comme en été", () => {
  assert.equal(toParisDateTimeInput("2026-11-05T22:59:00.000Z"), "2026-11-05T23:59");
  assert.equal(toParisDateTimeInput("2026-07-01T08:30:00.000Z"), "2026-07-01T10:30");
  assert.equal(toParisDateTimeInput("2026-12-31T23:30:00.000Z"), "2027-01-01T00:30");
  assert.equal(toParisDateTimeInput(null), "");
  assert.equal(toParisDateTimeInput("pas une date"), "");
});

test("AUDIT-0411 : la saisie est relue comme heure de Paris", () => {
  assert.equal(fromParisDateTimeInput("2026-11-05T23:59"), "2026-11-05T22:59:00.000Z");
  assert.equal(fromParisDateTimeInput("2026-07-01T10:30"), "2026-07-01T08:30:00.000Z");
  // Jours de changement d'heure (29 mars et 25 octobre 2026).
  assert.equal(fromParisDateTimeInput("2026-03-29T12:00"), "2026-03-29T10:00:00.000Z");
  assert.equal(fromParisDateTimeInput("2026-10-25T12:00"), "2026-10-25T11:00:00.000Z");
  assert.equal(fromParisDateTimeInput("05/11/2026 23:59"), null);
});

test("AUDIT-0411 : afficher puis enregistrer sans rien changer ne déplace plus la livraison", () => {
  for (const iso of ["2026-11-05T22:59:00.000Z", "2026-07-14T06:00:00.000Z", "2026-03-29T01:30:00.000Z"]) {
    assert.equal(fromParisDateTimeInput(toParisDateTimeInput(iso)), iso);
  }
});

test("AUDIT-0411 : l'échéance affichée suit l'heure de Paris, quel que soit le fuseau du navigateur", async () => {
  const { formatDate, formatDateTime } = await import("../src/lib/utils");
  assert.match(formatDateTime("2026-11-05T22:59:00.000Z"), /5 nov\. 2026.*23:59/);
  assert.match(formatDate("2026-11-05T23:30:00.000Z"), /6 nov\. 2026/);
});
