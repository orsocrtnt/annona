import assert from "node:assert/strict";
import test from "node:test";
import { parseRefundArgs, refundRequestKey } from "../scripts/saas01b/refund";

const args = ["--invoice", "in_1Abc", "--amount", "1000", "--operator", "Ops@TutelLiv.fr", "--reason", "Erreur de facturation constatée"];

test("SAAS-01B remboursement : sans --apply, la commande reste un essai", () => {
  const request = parseRefundArgs(args);
  assert.deepEqual(request, { invoiceId: "in_1Abc", amountCents: 1000, operatorEmail: "ops@tutelliv.fr", reason: "Erreur de facturation constatée", apply: false });
  assert.equal(parseRefundArgs([...args, "--apply"]).apply, true);
});

test("SAAS-01B remboursement : facture, montant, opérateur et motif sont exigés", () => {
  const replace = (name: string, value: string) => args.map((item, index) => (args[index - 1] === `--${name}` ? value : item));
  assert.throws(() => parseRefundArgs(replace("invoice", "ch_1Abc")), /INVOICE_INVALID/);
  for (const amount of ["0", "-5", "10.5", "123456789"]) assert.throws(() => parseRefundArgs(replace("amount", amount)), /AMOUNT_INVALID/, amount);
  assert.throws(() => parseRefundArgs(replace("operator", "ops")), /OPERATOR_INVALID/);
  assert.throws(() => parseRefundArgs(replace("reason", "erreur")), /REASON_INVALID/);
});

test("SAAS-01B remboursement : la même demande garde la même clé, une autre demande en change", () => {
  const { apply: _apply, ...request } = parseRefundArgs(args);
  assert.equal(refundRequestKey(request), refundRequestKey({ ...request }));
  assert.notEqual(refundRequestKey(request), refundRequestKey({ ...request, amountCents: 999 }));
  assert.notEqual(refundRequestKey(request), refundRequestKey({ ...request, reason: "Autre motif documenté" }));
  assert.ok(refundRequestKey(request).length <= 160);
});
