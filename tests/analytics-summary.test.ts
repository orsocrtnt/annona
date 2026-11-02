import assert from "node:assert/strict";
import test from "node:test";
import { collectedShare, splitInvoicedAmounts, volumeSummary } from "../src/lib/analytics/summary";

test("le volume se résume par son total, son pic et sa moyenne", () => {
  const s = volumeSummary([{ date: "2026-10-25", count: 2 }, { date: "2026-10-26", count: 0 }, { date: "2026-10-27", count: 4 }]);
  assert.equal(s.total, 6);
  assert.deepEqual(s.peak, { date: "2026-10-27", count: 4 });
  assert.equal(s.average, 2);
  assert.deepEqual(volumeSummary([{ date: "2026-10-27", count: 0 }]), { total: 0, peak: null, average: 0 }, "aucun pic sans livraison");
  assert.deepEqual(volumeSummary([]), { total: 0, peak: null, average: 0 });
});

test("la part encaissée est arrondie et absente sans facture", () => {
  assert.equal(collectedShare(89.9, 134.9), 67);
  assert.equal(collectedShare(0, 45), 0);
  assert.equal(collectedShare(0, 0), null);
});

test("ANALYSE-ENCAISSE : encaissé + en attente + en retard égale le total, retards comptés, brouillons et annulées exclus", () => {
  const now = new Date("2026-11-10T12:00:00Z");
  const split = splitInvoicedAmounts([
    { status: "PAID", amount: 100, dueDate: null },
    { status: "PENDING", amount: 50, dueDate: "2026-11-20T00:00:00Z" },
    { status: "PENDING", amount: 30, dueDate: "2026-11-01T00:00:00Z" },
    { status: "OVERDUE", amount: 20, dueDate: "2026-10-01T00:00:00Z" },
    { status: "DRAFT", amount: 999, dueDate: null },
    { status: "CANCELLED", amount: 999, dueDate: null },
  ], now);
  assert.deepEqual(split, { collectedAmount: 100, pendingInvoiceAmount: 50, overdueInvoiceAmount: 50, invoicedAmount: 200 });
  assert.equal(collectedShare(split.collectedAmount, split.invoicedAmount), 50);
});
