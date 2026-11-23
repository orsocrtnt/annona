// CLI-03 / lot 2 (demande 10) : le catalogue d'un commerçant garde les pains, qui n'ont pas de format de pâtisserie.
// Régression du 23 novembre 2026 : `NOT: { pastryFormat: "LARGE" }` écartait aussi les produits au format NULL,
// donc tous les pains (constaté sur annona-dev : catalogue vide pour le commerçant de la démo).
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("CLI-03 : les produits sans format (pains) restent au catalogue ; seuls les gros gâteaux passent par leurs tailles", () => {
  const source = readFileSync(new URL("../src/domains/order/merchant-catalog.service.ts", import.meta.url), "utf8");
  assert.doesNotMatch(source, /NOT: \{ pastryFormat: "LARGE" \}/);
  assert.match(source, /OR: \[\{ pastryFormat: null \}, \{ pastryFormat: \{ not: "LARGE" \} \}\]/);
});
