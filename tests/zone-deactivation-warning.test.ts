import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { zoneDeactivationWarnings } from "../src/features/settings/zone-deactivation";

// RECETTE-V1, décision du 11 novembre 2026 : avertir sans bloquer avant de désactiver une tournée
// qui retire tout créneau à des clients (CLI : un client ne voit que les créneaux de sa tournée).

const zone = (id: string, active: boolean, merchantCount: number) => ({ id, active, merchantCount });

test("RECETTE-V1 tournées : tournée sans client et une autre active → aucun avertissement", () => {
  const sud = zone("sud", true, 0);
  assert.deepEqual(zoneDeactivationWarnings(sud, [sud, zone("nord", true, 3)]), []);
});

test("RECETTE-V1 tournées : clients rattachés → nombre de clients qui ne pourront plus commander", () => {
  const sud = zone("sud", true, 4);
  const warnings = zoneDeactivationWarnings(sud, [sud, zone("nord", true, 1)]);
  assert.equal(warnings.length, 1);
  assert.match(warnings[0]!, /^4 clients sont rattachés.*ne pourront plus commander/);
  assert.match(zoneDeactivationWarnings(zone("x", true, 1), [zone("x", true, 1), zone("y", true, 0)])[0]!, /^1 client est rattaché.*il ne pourra plus/);
});

test("RECETTE-V1 tournées : dernière tournée active (les autres désactivées) → plus aucun client ne pourra commander", () => {
  const sud = zone("sud", true, 0);
  const warnings = zoneDeactivationWarnings(sud, [sud, zone("nord", false, 2)]);
  assert.deepEqual(warnings, ["C'est la dernière tournée active : plus aucun client ne pourra commander."]);
  assert.equal(zoneDeactivationWarnings(zone("sud", true, 2), [zone("sud", true, 2)]).length, 2);
});

test("RECETTE-V1 tournées : réactiver ou toucher une tournée déjà désactivée → aucun avertissement", () => {
  assert.deepEqual(zoneDeactivationWarnings(zone("sud", false, 5), [zone("sud", false, 5)]), []);
});

test("RECETTE-V1 tournées : l'écran passe par la confirmation et garde « Désactiver quand même » (sans blocage)", () => {
  const source = readFileSync("src/features/settings/zones-card.tsx", "utf8");
  assert.match(source, /onCheckedChange=\{toggle\}/);
  assert.match(source, /zoneDeactivationWarnings\(zone, zones\)/);
  assert.match(source, /t\.deactivateConfirm/);
});
