import assert from "node:assert/strict";
import test from "node:test";
import { invoiceLineItemSchema } from "../src/lib/validations/invoice";
import { demoInvoiceLineItems } from "../src/domains/demo/demo-invoice-lines";

test("les lignes des factures démo respectent le contrat lu par la page et le PDF", () => {
  const lines = demoInvoiceLineItems([
    { name: "Colis documents", quantity: 2, unitPrice: 29.95 },
    { name: "Emballage fragile", quantity: 1, unitPrice: 30 },
  ]);
  for (const line of lines) assert.equal(invoiceLineItemSchema.safeParse(line).success, true, JSON.stringify(line));
  assert.deepEqual(lines.map((line) => [line.label, line.amount, line.quantity]), [
    ["Colis documents", 29.95, 2],
    ["Emballage fragile", 30, 1],
  ]);
  assert.equal(lines.reduce((sum, line) => sum + line.amount * line.quantity, 0), 89.9);
});
