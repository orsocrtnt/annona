import assert from "node:assert/strict";
import test from "node:test";
import {
  assertOps03aBucket,
  assertOps03aSchema,
  databaseUrlForOps03aSchema,
  quoteOps03aSchema,
} from "../scripts/ops03a/rehearsal-safety";

test("OPS-03A limite les suppressions aux schémas temporaires strictement nommés", () => {
  const allowed = "ops03a_rehearsal_012345abcdef_source";
  assert.equal(assertOps03aSchema(allowed), allowed);
  assert.equal(quoteOps03aSchema(allowed), `"${allowed}"`);

  for (const refused of [
    "public",
    "auth",
    "storage",
    "ops03a_rehearsal_012345abcdef_source_extra",
    "ops03a_rehearsal_012345ABCDEF_restore",
    "ops03a_rehearsal_012345abcdef_restore; DROP SCHEMA public",
  ]) {
    assert.throws(() => assertOps03aSchema(refused), /SCHEMA_REFUSED/);
  }
});

test("OPS-03A limite les suppressions aux buckets temporaires strictement nommés", () => {
  assert.equal(
    assertOps03aBucket("ops03a-rehearsal-fedcba654321-restore"),
    "ops03a-rehearsal-fedcba654321-restore"
  );
  for (const refused of [
    "delivery-pods",
    "ops03a-rehearsal-fedcba654321-restore-extra",
    "ops03a-rehearsal-FEDCBA654321-source",
    "ops03a-rehearsal-fedcba654321-source/foreign",
  ]) {
    assert.throws(() => assertOps03aBucket(refused), /BUCKET_REFUSED/);
  }
});

test("OPS-03A conserve la cible PostgreSQL et remplace seulement le schéma", () => {
  const schema = "ops03a_rehearsal_fedcba654321_restore";
  const result = new URL(databaseUrlForOps03aSchema(
    "postgresql://user:password@example.invalid:5432/database?sslmode=require&schema=public",
    schema
  ));
  assert.equal(result.hostname, "example.invalid");
  assert.equal(result.pathname, "/database");
  assert.equal(result.searchParams.get("sslmode"), "require");
  assert.equal(result.searchParams.get("schema"), schema);
  assert.throws(
    () => databaseUrlForOps03aSchema("https://example.invalid", schema),
    /DATABASE_URL_REFUSED/
  );
});
