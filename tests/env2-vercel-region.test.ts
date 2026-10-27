import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

// ENV-2 / PERF-02 : la base Supabase est à Paris (eu-west-3). Des fonctions en iad1 (Washington)
// ajoutaient un aller-retour transatlantique à chaque requête SQL (886 ms médians mesurés le 27 octobre 2026).
test("ENV-2 : les fonctions Vercel tournent à Paris, au plus près de la base", () => {
  const config = JSON.parse(readFileSync("vercel.json", "utf8")) as { regions?: string[] };
  assert.deepEqual(config.regions, ["cdg1"]);
});
