import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { rowToModel } from "../src/domains/user/user.service";

/**
 * Lot 1, demande 9 : le compte est relu en une seule requête SQL (`to_jsonb`), convertie champ par champ
 * d'après le schéma Prisma. Vérifié sur la base `annona-dev` : objet identique à l'ancienne lecture `include`
 * pour les 11 comptes de démonstration (compte rendu docs/rapports/2026-11-10-lot1-d9-telephone-lenteur.md).
 */
test("LOT1-D9 : colonnes → champs Prisma, dates sans fuseau lues en UTC, JSON et énumérations gardés", () => {
  const user = rowToModel<Record<string, unknown>>("User", {
    id: "u1", auth_id: "auth-1", email: "a@exemple.test", first_name: "Ana", last_name: "Admin", phone: null, avatar_url: null,
    settings: { miniAdmin: { modules: ["orders"] } }, status: "ACTIVE", company_id: "c1", role_id: "r1", merchant_id: null,
    created_at: "2026-11-10T08:00:00.123", updated_at: "2026-11-10T09:00:00+00:00", last_login_at: null, inconnue: "ignorée",
  });
  assert.equal(user.authId, "auth-1");
  assert.equal(user.firstName, "Ana");
  assert.deepEqual(user.settings, { miniAdmin: { modules: ["orders"] } });
  assert.ok(user.createdAt instanceof Date);
  assert.equal((user.createdAt as Date).toISOString(), "2026-11-10T08:00:00.123Z");
  assert.equal((user.updatedAt as Date).toISOString(), "2026-11-10T09:00:00.000Z");
  assert.equal(user.lastLoginAt, null);
  assert.equal("inconnue" in user, false);
  assert.equal("auth_id" in user, false);
  // Une ligne déjà en noms de champs (tests) est acceptée.
  assert.equal(rowToModel<Record<string, unknown>>("Role", { id: "r1", systemRole: "ADMIN", isSystem: true }).systemRole, "ADMIN");
});

test("LOT1-D9 : une seule requête pour compte, entreprise, rôle et permissions ; verrou du jour lu en parallèle", () => {
  const service = readFileSync("src/domains/user/user.service.ts", "utf8");
  const lookup = service.slice(service.indexOf("export async function getUserByAuthId"));
  assert.match(lookup, /prisma\.\$queryRaw<AuthRow\[\]>/);
  assert.doesNotMatch(lookup.slice(0, lookup.indexOf("\n}\n")), /findUnique|include:/);
  assert.match(readFileSync("src/domains/order/order-lock.service.ts", "utf8"), /Promise\.all\(\[loadCompany\(db, companyId\), deliveryDateLockedAt\(companyId, date, db\)\]\)/);
});
