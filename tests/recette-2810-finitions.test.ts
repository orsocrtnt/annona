import assert from "node:assert/strict";
import test from "node:test";
import { effectiveInvoiceStatus } from "../src/domains/invoice/invoice-due";

test("RECETTE-2810 point 5 : une facture PENDING échue s'affiche en retard à la lecture, comme Paiements", () => {
  const now = new Date("2026-10-29T10:00:00Z");
  assert.deepEqual(effectiveInvoiceStatus({ status: "PENDING", dueDate: "2026-10-24T08:00:00Z" }, now), { status: "OVERDUE", daysOverdue: 5 });
  assert.deepEqual(effectiveInvoiceStatus({ status: "PENDING", dueDate: "2026-10-29T08:00:00Z" }, now), { status: "PENDING", daysOverdue: 0 });
  assert.deepEqual(effectiveInvoiceStatus({ status: "PENDING", dueDate: null }, now), { status: "PENDING", daysOverdue: 0 });
  assert.deepEqual(effectiveInvoiceStatus({ status: "PAID", dueDate: "2026-10-01T00:00:00Z" }, now), { status: "PAID", daysOverdue: 0 });
  assert.equal(effectiveInvoiceStatus({ status: "OVERDUE", dueDate: "2026-10-24T08:00:00Z" }, now).daysOverdue, 5);
});

