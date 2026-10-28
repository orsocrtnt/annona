import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test, { type TestContext } from "node:test";
import { contactSourceHash, submitContactMessage } from "../src/domains/growth/contact.service";

// SEC-7 : empreinte des sources Contact avec un secret dédié (CONTACT_HMAC_SECRET),
// repli documenté sur la clé service tant que la variable n'est pas déployée.
const valid = { name: "Camille Martin", email: "camille@example.invalid", message: "Nous livrons 300 colis par jour, rappelez-nous." };
function db() {
  const rows: Array<{ sourceHash: string }> = [];
  const contactMessage = {
    count: async () => 0,
    create: async ({ data }: { data: { sourceHash: string } }) => { rows.push(data); return data; },
  };
  return { rows, db: { contactMessage, $transaction: async <T>(fn: (tx: unknown) => Promise<T>) => fn({ contactMessage, $queryRaw: async () => [] }) } as never };
}
function env(t: TestContext, values: Record<string, string | undefined>) {
  for (const [key, value] of Object.entries(values)) {
    const previous = process.env[key];
    if (value === undefined) delete process.env[key]; else process.env[key] = value;
    t.after(() => { if (previous === undefined) delete process.env[key]; else process.env[key] = previous; });
  }
}

test("secret dédié prioritaire sur la clé service", async (t) => {
  env(t, { CONTACT_HMAC_SECRET: "dedicated-test-secret", SUPABASE_SERVICE_ROLE_KEY: "service-test-key" });
  const memory = db();
  await submitContactMessage(valid, "203.0.113.7", { db: memory.db });
  assert.equal(memory.rows[0]!.sourceHash, contactSourceHash("203.0.113.7", "dedicated-test-secret"));
});

test("repli sur la clé service si le secret dédié est absent ou vide", async (t) => {
  for (const dedicated of [undefined, ""]) {
    env(t, { CONTACT_HMAC_SECRET: dedicated, SUPABASE_SERVICE_ROLE_KEY: "service-test-key" });
    const memory = db();
    await submitContactMessage(valid, "203.0.113.7", { db: memory.db });
    assert.equal(memory.rows[0]!.sourceHash, contactSourceHash("203.0.113.7", "service-test-key"));
  }
});

test("aucun secret : refus explicite, rien n'est écrit", async (t) => {
  env(t, { CONTACT_HMAC_SECRET: undefined, SUPABASE_SERVICE_ROLE_KEY: undefined });
  const memory = db();
  await assert.rejects(submitContactMessage(valid, "203.0.113.7", { db: memory.db }));
  assert.equal(memory.rows.length, 0);
});

test(".env.example documente CONTACT_HMAC_SECRET avec une valeur fictive", () => {
  const example = readFileSync(".env.example", "utf8");
  const line = example.split("\n").find((entry) => entry.startsWith("CONTACT_HMAC_SECRET="));
  assert.ok(line, "variable documentée");
  assert.match(line!, /^CONTACT_HMAC_SECRET=your_/);
});

test("fichier mort dispatch-map-utils (HTML non échappé) supprimé", () => {
  assert.equal(existsSync("src/features/back-office/dispatch-map-utils.ts"), false);
});
