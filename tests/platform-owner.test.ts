import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { OwnerProvisionError, planOwnerAccount } from "../src/domains/admin/platform-owner";

test("le compte propriétaire est actif, sans entreprise, et unique", () => {
  const plan = planOwnerAccount({
    email: " Proprietaire@Annona.fr ",
    password: "mot-de-passe-solide",
    existingSuperAdminCount: 0,
  });
  assert.deepEqual(
    { email: plan.email, companyId: plan.companyId, status: plan.status, roleSlug: plan.roleSlug },
    { email: "proprietaire@annona.fr", companyId: null, status: "ACTIVE", roleSlug: "super-admin" },
  );
  assert.throws(
    () => planOwnerAccount({ email: "a@b.c", password: "court", existingSuperAdminCount: 0 }),
    OwnerProvisionError,
  );
  assert.throws(
    () => planOwnerAccount({ email: "pas-un-email", password: "mot-de-passe-solide", existingSuperAdminCount: 0 }),
    OwnerProvisionError,
  );
  assert.throws(
    () => planOwnerAccount({ email: "a@b.c", password: "mot-de-passe-solide", existingSuperAdminCount: 1 }),
    OwnerProvisionError,
  );
});

test("la création serveur ne passe pas par l'inscription publique", () => {
  const script = readFileSync("scripts/platform/create-owner.ts", "utf8");
  const signup = readFileSync("src/domains/signup/signup.service.ts", "utf8");
  assert.equal(script.includes("validatePreproductionEnvironment"), true);
  assert.equal(script.includes("planOwnerAccount"), true);
  assert.equal(script.includes('companyId: plan.companyId'), true);
  assert.equal(script.includes("status: plan.status"), true);
  assert.equal(script.includes("auth.admin.createUser"), true);
  assert.equal(script.includes("auth.admin.deleteUser"), true);
  assert.equal(script.includes("signup"), false);
  assert.equal(script.includes("console.log(password"), false);
  assert.equal(script.includes("PLATFORM_OWNER_PASSWORD"), true);
  assert.equal(signup.includes("super-admin"), false);
  assert.equal(signup.includes('slug: "company-admin"'), true);
});
