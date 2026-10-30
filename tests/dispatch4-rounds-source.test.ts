import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { companyDispatchSettingsSchema, DEFAULT_DISPATCH_SETTINGS } from "../src/lib/validations/dispatch-settings";

const service = readFileSync("src/domains/delivery/delivery-rounds.service.ts", "utf8");
const route = readFileSync("src/app/api/dispatch/rounds/route.ts", "utf8");
const assign = readFileSync("src/domains/delivery/delivery.service.ts", "utf8");

test("réglages enregistrés avant les tournées : valeurs par défaut, aucune affectation automatique", () => {
  const { rounds: _rounds, ...old } = DEFAULT_DISPATCH_SETTINGS;
  const parsed = companyDispatchSettingsSchema.parse(old);
  assert.deepEqual(parsed.rounds, { autoAssign: false, stopMinutes: 5, dayMinutes: 480, maxDeliveries: 12 });
});

test("tournées : aucune coordonnée dans ce qui part vers le dispatcher", () => {
  const present = service.slice(service.indexOf("function presentRound"), service.indexOf("export type PresentedRound"));
  assert.doesNotMatch(present, /latitude|longitude/);
});

test("tournées : rôles, option payante et écriture contrôlés côté serveur", () => {
  assert.match(route, /requireStaffRole\("deliveries:dispatch"\)/);
  assert.match(route, /\["COMPANY_ADMIN", "MINI_ADMIN", "DISPATCHER"\]/);
  assert.match(route, /assertSaasMutationFeature\(companyId, "auto_dispatch"\)/);
});

test("une tournée ne prend que des livraisons encore à affecter, par la même affectation que le reste", () => {
  assert.match(service, /status: "PENDING",\s+driverId: null/);
  assert.match(service, /expectUnassigned: true/);
  assert.match(service, /round: \{ id: roundId, sequence: index \+ 1 \}/);
});

test("toute autre affectation ou un retrait sort la livraison de sa tournée", () => {
  assert.match(assign, /roundId: options\?\.round\?\.id \?\? null/);
  assert.ok((assign.match(/roundId: null,\s+roundSequence: null/g) ?? []).length >= 2);
});
