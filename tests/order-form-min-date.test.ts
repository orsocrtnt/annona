import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("la date minimale de livraison suit le jour local du navigateur, pas l'UTC du rendu", () => {
  const form = readFileSync(new URL("../src/features/client-portal/create-order-form.tsx", import.meta.url), "utf8");

  assert.doesNotMatch(form, /min=\{new Date\(\)/);
  assert.doesNotMatch(form, /toISOString\(\)\.slice\(0, 10\)/);
  assert.match(form, /setMinDeliveryDate\(`\$\{now\.getFullYear\(\)\}/);
  assert.equal(form.match(/min=\{minDeliveryDate\}/g)?.length, 2);
});
