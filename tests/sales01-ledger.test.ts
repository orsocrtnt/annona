import assert from "node:assert/strict";
import test from "node:test";
import { createSalesAttributionSnapshot } from "../src/domains/sales/commission-core";
import { commissionEntriesForInvoices, type CommissionInvoice } from "../src/domains/sales/commission-ledger";
import { recordSalesCommissions } from "../src/domains/sales/sales-code.service";

// Accompagné 25 % ; Starter 79 € + option 29 € = 108 € HT par mois, soit 27 € de commission.
const attribution = createSalesAttributionSnapshot({
  sellerReference: "code-1",
  level: "ASSISTED",
  startsAt: new Date("2026-01-31T10:00:00.000Z"),
  initialContractHash: "contract-hash",
  initialLines: [
    { code: "plan:STARTER", name: "Starter", quantity: 1, unitHtCents: 7900 },
    { code: "AUTO", name: "Dispatch", quantity: 1, unitHtCents: 2900 },
  ],
});

function invoice(id: string, overrides: Partial<CommissionInvoice> = {}): CommissionInvoice {
  return { id, status: "paid", reason: "subscription_cycle", currency: "EUR", subtotalCents: 10800, totalCents: 12960, paidCents: 12960, refundedCents: 0, periodStart: "2026-02-28T09:59:50.000Z", ...overrides };
}
// La souscription Stripe démarre quelques secondes avant l'activation qui fige l'attribution.
const initial = invoice("in_initial", { reason: "subscription_create", periodStart: "2026-01-31T09:59:50.000Z" });
const summary = (entries: ReturnType<typeof commissionEntriesForInvoices>) => entries.map((row) => `${row.settlementKey}=${row.explanation}:${row.commissionCents}`);

test("SALES-1 commissions : paiement initial et renouvellements dans la fenêtre, 13e paiement exclu", () => {
  const renewals = Array.from({ length: 12 }, (_, index) => invoice(`in_cycle_${index + 1}`, {
    periodStart: new Date(Date.UTC(2026, 1 + index, index === 0 ? 28 : 28, 9, 59, 50)).toISOString(),
  }));
  renewals[10]!.periodStart = "2026-12-31T09:59:50.000Z";
  renewals[11]!.periodStart = "2027-01-31T09:59:50.000Z";
  const entries = commissionEntriesForInvoices(attribution, [initial, ...renewals], []);
  const eligible = entries.filter((row) => row.explanation === "ELIGIBLE");
  assert.equal(eligible.length, 12, "le paiement initial et onze renouvellements");
  assert.ok(eligible.every((row) => row.commissionCents === 2700 && row.eligibleHtCents === 10800 && row.rateBps === 2500));
  assert.deepEqual(summary(entries).at(-1), "in_cycle_12:paid=OUTSIDE_WINDOW:0", "douze mois exactement après la première période");
  assert.match(entries[0]!.id, /^[a-f0-9]{64}$/);
  assert.equal(new Set(entries.map((row) => row.id)).size, entries.length);
});

test("SALES-1 commissions : impayé, changement, consommation et facture hors contrat sont expliqués à zéro", () => {
  const entries = commissionEntriesForInvoices(attribution, [
    initial,
    invoice("in_draft", { status: "draft" }),
    invoice("in_open", { status: "open", paidCents: 0 }),
    invoice("in_unpaid", { status: "uncollectible", paidCents: 0 }),
    invoice("in_void", { status: "void", paidCents: 0 }),
    invoice("in_change", { reason: "subscription_update", subtotalCents: 1000, totalCents: 1200, paidCents: 1200 }),
    invoice("in_usage", { reason: "usage", subtotalCents: 500, totalCents: 600, paidCents: 600 }),
    invoice("in_upgraded", { subtotalCents: 17900, totalCents: 21480, paidCents: 21480 }),
    invoice("in_partial", { paidCents: 6000 }),
    invoice("in_manual", { reason: "manual" }),
  ], []);
  assert.deepEqual(summary(entries), [
    "in_initial:paid=ELIGIBLE:2700",
    "in_open:open=NOT_PAID:0",
    "in_unpaid:uncollectible=NOT_PAID:0",
    "in_void:void=NOT_PAID:0",
    "in_change:paid=LATER_CHANGE_OR_USAGE:0",
    "in_usage:paid=LATER_CHANGE_OR_USAGE:0",
    "in_upgraded:paid=CONTRACT_CHANGED:0",
    "in_partial:paid=PARTIAL_PAYMENT:0",
    "in_manual:paid=UNRECOGNISED_INVOICE:0",
  ]);
  assert.deepEqual(commissionEntriesForInvoices(attribution, [invoice("in_cycle")], []), [], "sans paiement initial confirmé, aucune écriture");
});

test("SALES-1 commissions : facture ouverte puis payée garde les deux écritures", () => {
  const open = commissionEntriesForInvoices(attribution, [initial, invoice("in_cycle", { status: "open", paidCents: 0 })], []);
  const paid = commissionEntriesForInvoices(attribution, [initial, invoice("in_cycle")], open);
  assert.deepEqual(summary(paid), ["in_cycle:paid=ELIGIBLE:2700"]);
});

test("SALES-1 commissions : remboursement repris au prorata, cumulatif et idempotent", () => {
  let ledger = commissionEntriesForInvoices(attribution, [initial], []);
  const step = (refundedCents: number) => {
    const added = commissionEntriesForInvoices(attribution, [{ ...initial, refundedCents }], ledger);
    ledger = [...ledger, ...added];
    return summary(added);
  };
  assert.deepEqual(step(1296), ["in_initial:refund:1296=REFUND:-270"], "10 % remboursé : 10 % de 27 €");
  assert.deepEqual(step(1296), [], "rejeu sans effet");
  assert.deepEqual(step(1300), ["in_initial:refund:1300=REFUND:-1"], "arrondi au centime supérieur, jamais en faveur du commercial");
  assert.deepEqual(step(20000), ["in_initial:refund:12960=REFUND:-2429"], "plafonné au paiement");
  assert.equal(ledger.reduce((sum, row) => sum + row.commissionCents, 0), 0, "remboursement total : commission nette nulle");
  assert.deepEqual(step(12960), []);
});

test("SALES-1 commissions : enregistrement dans la projection, sans jamais bloquer la facturation", async () => {
  const created: Array<Record<string, unknown>> = [];
  const tx = (found: unknown) => ({
    salesAttribution: { findUnique: async () => found },
    salesCommissionEntry: { createMany: async ({ data, skipDuplicates }: { data: Array<Record<string, unknown>>; skipDuplicates: boolean }) => {
      assert.equal(skipDuplicates, true);
      created.push(...data);
      return { count: data.length };
    } },
  }) as never;
  assert.equal(await recordSalesCommissions(tx(null), "company-1", [initial]), 0, "entreprise sans code commercial");
  assert.equal(await recordSalesCommissions(tx({ id: "attr-1", snapshot: attribution, commissionEntries: [] }), "company-1", [initial]), 1);
  assert.equal(created[0]!.attributionId, "attr-1");
  assert.equal(created[0]!.commissionCents, 2700);

  const logged: unknown[] = [];
  const original = console.error;
  console.error = (...args: unknown[]) => { logged.push(args); };
  try {
    const broken = { ...attribution, rateBps: 3333 };
    assert.equal(await recordSalesCommissions(tx({ id: "attr-2", snapshot: broken, commissionEntries: [] }), "company-2", [initial]), 0);
  } finally {
    console.error = original;
  }
  assert.equal(logged.length, 1, "règle d'arrondi absente : journalisée, rien d'écrit");
  assert.equal(created.length, 1);
});
