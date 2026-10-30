import assert from "node:assert/strict";
import test from "node:test";
import { summarizeClientBilling } from "../src/domains/invoice/invoice.service";
import { getVisiblePortalDashboardWidgets, normalizePortalDashboardLayout } from "../src/lib/dashboard/portal-dashboard-layout";

test("tableau de bord client : montant à régler = en attente + en retard, au centime près", () => {
  const summary = summarizeClientBilling(
    [
      { status: "PENDING", _sum: { amount: "10.10" }, _count: { _all: 2 } },
      { status: "OVERDUE", _sum: { amount: "20.20" }, _count: { _all: 1 } },
    ],
    { id: "inv_1", reference: "FAC-2026-0042", amount: "30.00", status: "OVERDUE", createdAt: new Date("2026-10-20T09:00:00Z"), dueDate: new Date("2026-10-25T09:00:00Z") }
  );
  assert.equal(summary.dueAmount, 30.3);
  assert.equal(summary.dueCount, 3);
  assert.equal(summary.overdueCount, 1);
  assert.deepEqual(summary.lastInvoice, {
    id: "inv_1",
    reference: "FAC-2026-0042",
    amount: 30,
    status: "OVERDUE",
    createdAt: "2026-10-20T09:00:00.000Z",
    dueDate: "2026-10-25T09:00:00.000Z",
  });
});

test("tableau de bord client : rien à régler et aucune facture", () => {
  assert.deepEqual(summarizeClientBilling([], null), { dueAmount: 0, dueCount: 0, overdueCount: 0, lastInvoice: null });
});

test("tableau de bord client : le bloc Factures est affiché par défaut, même pour une disposition plus ancienne", () => {
  const types = (layout: Parameters<typeof normalizePortalDashboardLayout>[0]) => getVisiblePortalDashboardWidgets(normalizePortalDashboardLayout(layout)).map((w) => w.type);
  assert.ok(types(null).includes("billing-summary"));
  assert.ok(types({ widgets: [{ type: "stats-row", visible: true, order: 0 }] }).includes("billing-summary"));
});
