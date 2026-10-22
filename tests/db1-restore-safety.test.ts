import assert from "node:assert/strict";
import test from "node:test";
import {
  assertDb1RehearsalSchema,
  databaseUrlForSchema,
  isDb1RehearsalSchema,
  quoteRehearsalSchema,
} from "../scripts/db1/rehearsal-safety";

test("DB-1 accepte uniquement ses schémas jetables strictement nommés", () => {
  const allowed = "db1_rehearsal_012345abcdef_source";
  assert.equal(isDb1RehearsalSchema(allowed), true);
  assert.equal(quoteRehearsalSchema(allowed), `"${allowed}"`);

  for (const refused of [
    "public",
    "storage",
    "auth",
    "db1_rehearsal_012345abcdef_source_extra",
    "db1_rehearsal_012345ABCDEF_restore",
    "db1_rehearsal_012345abcdef_restore; DROP SCHEMA public",
  ]) {
    assert.equal(isDb1RehearsalSchema(refused), false);
    assert.throws(() => assertDb1RehearsalSchema(refused), /SCHEMA_REFUSED/);
  }
});

test("DB-1 remplace seulement le schéma de la connexion PostgreSQL", () => {
  const schema = "db1_rehearsal_fedcba654321_restore";
  const result = new URL(databaseUrlForSchema(
    "postgresql://user:password@example.invalid:5432/database?sslmode=require&schema=public",
    schema
  ));

  assert.equal(result.hostname, "example.invalid");
  assert.equal(result.pathname, "/database");
  assert.equal(result.searchParams.get("sslmode"), "require");
  assert.equal(result.searchParams.get("schema"), schema);
  assert.throws(
    () => databaseUrlForSchema("https://example.invalid", schema),
    /DATABASE_URL_REFUSED/
  );
});
