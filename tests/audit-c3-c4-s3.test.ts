import assert from "node:assert/strict";
import test from "node:test";

test("C2 : numéro de facture lisible et sur six chiffres, le préfixe de l'entreprise conservé", async () => {
  const { formatInvoiceReference } = await import("../src/domains/invoice/invoice.service");
  assert.equal(formatInvoiceReference("FAC", 1), "FAC-000001");
  assert.equal(formatInvoiceReference("LIV", 123456), "LIV-123456");
  assert.equal(formatInvoiceReference("FAC", 1234567), "FAC-1234567");
});
