import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

// UX-04 : libellés qui désignent le résultat, action qui défait une affectation confirmée.
const source = readFileSync("src/features/back-office/assign-driver-select.tsx", "utf8");

test("UX-04 : le livreur affecté se change ou se retire par des libellés explicites", () => {
  assert.match(source, />\s*Changer de livreur\s*</);
  assert.match(source, />\s*Retirer le livreur\s*</);
  assert.doesNotMatch(source, />\s*(Changer|Retirer)\s*</);
});

test("UX-04 : retirer le livreur demande une confirmation avant l'appel serveur", () => {
  const confirmAt = source.indexOf("confirm(`Retirer le livreur de cette livraison ? (${assignedLabel})`)");
  const unassignAt = source.indexOf("await unassign.mutateAsync(deliveryId)");
  assert.ok(confirmAt > 0 && unassignAt > confirmAt);
});
