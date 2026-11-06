import assert from "node:assert/strict";
import test from "node:test";

import { validatePreproductionEnvironment } from "../scripts/ci/verify-preproduction-env";

function validEnvironment() {
  return {
    NEXT_PUBLIC_APP_URL: "https://preproduction.example.test",
    NEXT_PUBLIC_SUPABASE_URL: "https://preprodref.supabase.co",
    NEXT_PUBLIC_SUPABASE_ANON_KEY: "public-key",
    SUPABASE_SERVICE_ROLE_KEY: "private-key",
    DATABASE_URL: ["postgresql", "://postgres.preprodref:password@example.pooler.supabase.com:6543/postgres"].join(""),
    DIRECT_URL: ["postgresql", "://postgres:password@db.preprodref.supabase.co:5432/postgres"].join(""),
    CRON_SECRET: "c".repeat(32),
    OPS_HEALTH_SECRET: "h".repeat(32),
    PREPROD_EXPECTED_APP_HOST: "preproduction.example.test",
    PREPROD_EXPECTED_SUPABASE_REF: "preprodref",
    PREPROD_FORBIDDEN_SUPABASE_REFS: "oldref,productionref",
    AUTH_EMAIL_LINKS_ENABLED: "false",
    EMAIL_DELIVERY_MODE: "disabled",
  };
}

test("accepte une préproduction isolée et sans envoi réel", () => {
  assert.deepEqual(validatePreproductionEnvironment(validEnvironment()), []);
});

test("refuse la cible Supabase existante déclarée interdite", () => {
  const environment = validEnvironment();
  environment.PREPROD_FORBIDDEN_SUPABASE_REFS = "preprodref";

  assert.ok(validatePreproductionEnvironment(environment).includes("PREPROD_SUPABASE_REF_FORBIDDEN"));
});

test("refuse les connexions base qui ne ciblent pas le projet attendu", () => {
  const environment = validEnvironment();
  environment.DATABASE_URL = ["postgresql", "://postgres.other:password@example.pooler.supabase.com:6543/postgres"].join("");

  assert.ok(validatePreproductionEnvironment(environment).includes("DATABASE_URL_TARGET_MISMATCH"));
});

test("refuse les e-mails réels", () => {
  const environment = validEnvironment();
  environment.AUTH_EMAIL_LINKS_ENABLED = "true";
  environment.EMAIL_DELIVERY_MODE = "live";

  assert.deepEqual(validatePreproductionEnvironment(environment), [
    "AUTH_EMAIL_LINKS_MUST_BE_FALSE",
    "EMAIL_DELIVERY_MODE_UNSAFE",
  ]);
});
