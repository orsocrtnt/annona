import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

// DISPATCH-4 / C12 : « Dispatch intelligent » à 39 € HT en Starter, le reste du catalogue C9 recopié à l'identique.
const sql = readFileSync("prisma/migrations/20261029200000_catalog_c10_dispatch_intelligent/migration.sql", "utf8");

test("catalogue C10 : C9 retiré, C10 actif, copie des formules et options de C9", () => {
  assert.match(sql, /SET status = 'RETIRED'.*WHERE code = 'C9-2026-10-24' AND status = 'ACTIVE'/);
  assert.match(sql, /'saas_catalog_c10_v1', 'C10-2026-10-29', 'ACTIVE'/);
  assert.match(sql, /FROM saas_plans WHERE catalog_version_id = 'saas_catalog_c9_v1'/);
  assert.match(sql, /FROM saas_options WHERE catalog_version_id = 'saas_catalog_c9_v1'/);
  // Formules inchangées : aucun prix de formule n'est réécrit.
  assert.doesNotMatch(sql.split("INSERT INTO saas_options")[0]!, /CASE WHEN/);
});

test("catalogue C10 : seule l'option AUTO_DISPATCH change de nom et de prix (39 € par mois, 12 × 39 € par an)", () => {
  assert.match(sql, /CASE WHEN code = 'AUTO_DISPATCH' THEN 'Dispatch intelligent' ELSE name END/);
  assert.match(sql, /CASE WHEN code = 'AUTO_DISPATCH' THEN 3900 ELSE monthly_price_cents END/);
  assert.match(sql, /CASE WHEN code = 'AUTO_DISPATCH' THEN 46800 ELSE annual_price_cents END/);
  assert.equal(46800, 3900 * 12);
  // Le code et la fonctionnalité restent : les droits `auto_dispatch` existants ne bougent pas.
  assert.match(sql, /code,\s*\n\s*CASE WHEN code = 'AUTO_DISPATCH'/);
  assert.match(sql, /kind, feature_key, seat_role/);
});
