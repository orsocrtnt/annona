import assert from "node:assert/strict";
import test from "node:test";

import { DEV_SUPABASE_REF, FORBIDDEN_SUPABASE_REFS, validateDevEnvironment } from "../scripts/env2/verify-dev-env";

function databaseUrl(ref: string, port: number) {
  return ["postgresql", `://postgres.${ref}:password@aws-1-eu-west-3.pooler.supabase.com:${port}/postgres`].join("");
}

function validEnvironment() {
  return {
    NEXT_PUBLIC_APP_URL: "http://localhost:3108",
    NEXT_PUBLIC_SUPABASE_URL: `https://${DEV_SUPABASE_REF}.supabase.co`,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: "public-key",
    SUPABASE_SERVICE_ROLE_KEY: "private-key",
    DATABASE_URL: `${databaseUrl(DEV_SUPABASE_REF, 6543)}?pgbouncer=true`,
    DIRECT_URL: databaseUrl(DEV_SUPABASE_REF, 5432),
  };
}

test("ENV-2 : accepte le projet de développement avec une clé Stripe de test", () => {
  assert.deepEqual(validateDevEnvironment(validEnvironment()), []);
});

test("ENV-2 : refuse chaque projet interdit, côté Auth comme côté base", () => {
  for (const ref of FORBIDDEN_SUPABASE_REFS) {
    const errors = validateDevEnvironment({
      ...validEnvironment(),
      NEXT_PUBLIC_SUPABASE_URL: `https://${ref}.supabase.co`,
      DIRECT_URL: databaseUrl(ref, 5432),
    });
    assert.ok(errors.includes("DEV_SUPABASE_REF_FORBIDDEN"), ref);
    assert.ok(errors.includes("DIRECT_URL_TARGET_FORBIDDEN"), ref);
    assert.ok(errors.includes("DIRECT_URL_TARGET_MISMATCH"), ref);
  }
});

test("ENV-2 : refuse une base qui ne suit pas le projet Auth", () => {
  const errors = validateDevEnvironment({ ...validEnvironment(), DATABASE_URL: databaseUrl("autreprojet", 6543) });
  assert.deepEqual(errors, ["DATABASE_URL_TARGET_MISMATCH"]);
});

test("ENV-2 : refuse une application publique et un mot de passe absent", () => {
  const errors = validateDevEnvironment({
    ...validEnvironment(),
    NEXT_PUBLIC_APP_URL: "https://preproduction.example.test",
    DIRECT_URL: databaseUrl(DEV_SUPABASE_REF, 5432).replace(":password", ""),
  });
  assert.deepEqual(errors, ["DEV_APP_URL_NOT_LOCAL", "DIRECT_URL_CREDENTIALS_MISSING"]);
});

test("ENV-2 : les erreurs ne contiennent jamais de valeur d'environnement", () => {
  const errors = validateDevEnvironment({ ...validEnvironment(), DIRECT_URL: "pas une adresse secret-123" });
  assert.deepEqual(errors, ["DIRECT_URL_URL_INVALID"]);
  assert.ok(!errors.join(" ").includes("secret-123"));
});
