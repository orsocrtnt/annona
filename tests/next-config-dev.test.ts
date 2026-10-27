import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

// Next 15.5 (dev uniquement) : l'explorateur de segments ajoute des nœuds à côté de chaque segment,
// ce qui décale les useId entre serveur et client (ids Radix des menus, avertissement d'hydratation).
test("l'explorateur de segments du dev Next reste désactivé", () => {
  const config = readFileSync(new URL("../next.config.ts", import.meta.url), "utf8");
  assert.match(config, /devtoolSegmentExplorer:\s*false/);
});
