import assert from "node:assert/strict";
import test from "node:test";
import { isWriteConflict, retryOnWriteConflict } from "../src/domains/billing/billing.service";

const conflict = Object.assign(new Error("Raw query failed. Code: `40001`. Message: `could not serialize access due to concurrent update`"), { code: "P2010", meta: { code: "40001" } });

test("SAAS-01B : seuls les conflits d'écriture PostgreSQL sont rejouables", () => {
  assert.equal(isWriteConflict(conflict), true);
  assert.equal(isWriteConflict({ code: "P2034" }), true);
  assert.equal(isWriteConflict({ meta: { code: "40P01" } }), true);
  assert.equal(isWriteConflict(new Error("BILLING_PROVIDER_UNAVAILABLE")), false);
  assert.equal(isWriteConflict(new Error("BILLING_TENANT_MISMATCH")), false);
  assert.equal(isWriteConflict(null), false);
});

test("SAAS-01B : un conflit est rejoué, puis la réussite est rendue", async () => {
  let calls = 0;
  const waits: number[] = [];
  const result = await retryOnWriteConflict(async () => { calls++; if (calls < 3) throw conflict; return "ok"; }, 4, async (ms) => { waits.push(ms); });
  assert.equal(result, "ok");
  assert.equal(calls, 3);
  assert.equal(waits.length, 2);
});

test("SAAS-01B : une autre erreur n'est jamais rejouée, un conflit persistant finit par remonter", async () => {
  let calls = 0;
  await assert.rejects(retryOnWriteConflict(async () => { calls++; throw new Error("BILLING_TENANT_MISMATCH"); }, 4, async () => {}), /TENANT_MISMATCH/);
  assert.equal(calls, 1);
  calls = 0;
  await assert.rejects(retryOnWriteConflict(async () => { calls++; throw conflict; }, 4, async () => {}), /40001/);
  assert.equal(calls, 4);
});
