import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { PREMIUM_DISCOVERY_FEATURES, SAAS_FEATURES } from "../src/domains/saas/saas.service";
import { SAAS_FEATURE_LABELS, SESSION_SAAS_FEATURES } from "../src/domains/saas/saas-access";
import { FEATURE_COMPARISON_ORDER } from "../src/features/auth/signup-plan-comparison";

// OFFER-1 / C15 : option « Réception automatique des commandes » à 29 € HT en Starter, incluse en Pro et Business.
const sql = readFileSync("prisma/migrations/20261104030000_catalog_c11_order_automation/migration.sql", "utf8");

test("catalogue C11 : C10 retiré, C11 actif, formules et options de C10 recopiées", () => {
  assert.match(sql, /SET status = 'RETIRED'.*WHERE code = 'C10-2026-10-29' AND status = 'ACTIVE'/);
  assert.match(sql, /'saas_catalog_c11_v1', 'C11-2026-11-04', 'ACTIVE'/);
  assert.match(sql, /FROM saas_plans WHERE catalog_version_id = 'saas_catalog_c10_v1'/);
  assert.match(sql, /FROM saas_options WHERE catalog_version_id = 'saas_catalog_c10_v1'/);
  // Aucun prix de formule ni d'option existante n'est réécrit.
  assert.doesNotMatch(sql, /CASE WHEN code = '[A-Z_]+' THEN \d+/);
});

test("catalogue C11 : option ORDER_AUTOMATION en Starter seulement, incluse en Pro et Business", () => {
  assert.match(sql, /'ORDER_AUTOMATION', 'Réception automatique des commandes', 'OPTION', 'order_automation', NULL, 2900, 34800, ARRAY\['STARTER'\]/);
  assert.equal(34800, 2900 * 12);
  assert.match(sql, /CASE WHEN code IN \('PRO', 'BUSINESS'\) THEN array_append\(included_features, 'order_automation'\) ELSE included_features END/);
});

test("catalogue C11 : seuls les pilotes déjà complets reçoivent la nouvelle fonction", () => {
  assert.match(sql, /WHERE kind = 'PILOT'/);
  assert.match(sql, /@> '\["auto_dispatch","admin_gps","client_gps","advanced_analytics","priority_support"\]'::jsonb/);
  assert.match(sql, /AND NOT \(snapshot -> 'features'\) @> '\["order_automation"\]'::jsonb/);
});

test("clé order_automation : connue du serveur, de la session, du comparatif et de la découverte premium", () => {
  assert.ok(SAAS_FEATURES.includes("order_automation"));
  assert.ok(SESSION_SAAS_FEATURES.includes("order_automation"));
  assert.equal(SAAS_FEATURE_LABELS.order_automation, "Réception automatique des commandes");
  assert.ok(FEATURE_COMPARISON_ORDER.some((row) => row.key === "order_automation"));
  assert.ok((PREMIUM_DISCOVERY_FEATURES as readonly string[]).includes("order_automation"));
  assert.deepEqual([...SAAS_FEATURES].sort(), [...SESSION_SAAS_FEATURES].sort());
});
