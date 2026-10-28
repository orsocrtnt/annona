import assert from "node:assert/strict";
import test from "node:test";
import { canReleaseRejectedOperation, isWriteConflict, retryOnWriteConflict } from "../src/domains/billing/billing.service";

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

test("SAAS-01B : le verrou n'est rendu que si rien n'a été appliqué chez le fournisseur", () => {
  for (const kind of ["CHANGE", "CANCEL", "REFUND"] as const) {
    assert.equal(canReleaseRejectedOperation(kind, new Error("BILLING_PROVIDER_REJECTED")), true, `${kind} : refus de la première étape`);
    assert.equal(canReleaseRejectedOperation(kind, new Error("BILLING_PARTIAL_EFFECT")), false, `${kind} : une étape déjà appliquée garde le verrou`);
    assert.equal(canReleaseRejectedOperation(kind, new Error("BILLING_PROVIDER_UNAVAILABLE")), false, `${kind} : panne, seul le rejeu conclut`);
  }
  assert.equal(canReleaseRejectedOperation("CHANGE", new Error("BILLING_CHANGE_CONFLICT")), true, "conflit détecté avant tout appel");
  assert.equal(canReleaseRejectedOperation("CHANGE", new Error("BILLING_CHANGE_EMPTY")), true);
  for (const kind of ["CHECKOUT", "USAGE"] as const) {
    assert.equal(canReleaseRejectedOperation(kind, new Error("BILLING_PROVIDER_REJECTED")), false, `${kind} : rejeu de la clé uniquement`);
  }
});
