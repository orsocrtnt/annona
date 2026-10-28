import assert from "node:assert/strict";
import test from "node:test";
import { listCompanyInvoices } from "../src/domains/invoice/company-invoices.service";
import { createInvoiceFakeDb, invoice } from "./helpers/invoice-fake-db";

const NOW = new Date("2026-10-28T10:00:00.000Z");

function seed() {
  return createInvoiceFakeDb({
    invoices: [
      invoice({ id: "pending", reference: "F-1042", dueDate: new Date("2026-11-20T10:00:00.000Z"), orderId: "order_1", createdAt: new Date("2026-10-27T10:00:00.000Z") }),
      invoice({ id: "paid", reference: "F-1031", status: "PAID", paidAt: new Date("2026-10-27T08:00:00.000Z"), createdAt: new Date("2026-10-20T10:00:00.000Z") }),
      invoice({ id: "late", reference: "F-1027", dueDate: new Date("2026-10-16T09:00:00.000Z"), createdAt: new Date("2026-09-16T10:00:00.000Z") }),
      invoice({ id: "late_reminded", reference: "F-1020", status: "OVERDUE", dueDate: new Date("2026-10-10T09:00:00.000Z"), createdAt: new Date("2026-09-10T10:00:00.000Z") }),
      invoice({ id: "late_failed", reference: "F-1019", status: "OVERDUE", dueDate: new Date("2026-10-09T09:00:00.000Z"), createdAt: new Date("2026-09-09T10:00:00.000Z") }),
      invoice({ id: "foreign", reference: "F-B-1", companyId: "company_b", customerId: "client_b", dueDate: new Date("2026-10-01T09:00:00.000Z") }),
    ],
    users: [{ id: "client_a", companyId: "company_a", email: "a@example.test", firstName: "Studio", lastName: "Oberkampf" }],
    orders: [{ id: "order_1", companyId: "company_a", reference: "CMD-1042" }],
    jobs: [
      { id: "job_ok", jobKey: "k1", type: "CLIENT_NOTIFICATION", status: "SUCCEEDED", payload: {}, companyId: "company_a", maxAttempts: 3 },
      { id: "job_ko", jobKey: "k2", type: "CLIENT_NOTIFICATION", status: "FAILED", payload: {}, companyId: "company_a", maxAttempts: 3 },
    ],
    reminders: [
      { id: "r1", invoiceId: "late_reminded", companyId: "company_a", sentById: "admin_a", channel: "EMAIL", result: "SENT", operationJobId: "job_ok", completedAt: NOW, createdAt: new Date("2026-10-28T08:00:00.000Z") },
      { id: "r2", invoiceId: "late_failed", companyId: "company_a", sentById: "admin_a", channel: "EMAIL", result: "QUEUED", operationJobId: "job_ko", completedAt: null, createdAt: new Date("2026-10-28T08:00:00.000Z") },
    ],
  });
}

test("DEMO-3 liste : factures de l'entreprise seulement, compteurs payées / en attente / en retard", async () => {
  const db = seed();
  const result = await listCompanyInvoices("company_a", { status: "ALL", now: NOW }, db as never);

  assert.deepEqual(result.invoices.map((row) => row.reference), ["F-1042", "F-1031", "F-1027", "F-1020", "F-1019"]);
  assert.deepEqual(result.counts, { PAID: 1, PENDING: 1, OVERDUE: 3 });
  assert.equal(db.invoices.find((row) => row.id === "foreign")?.status, "PENDING", "aucun effet sur une autre entreprise");
});

test("DEMO-3 liste : la consultation passe d'abord en retard les factures échues de l'entreprise", async () => {
  const result = await listCompanyInvoices("company_a", { status: "OVERDUE", now: NOW }, seed() as never);
  const late = result.invoices.find((row) => row.id === "late");
  assert.equal(late?.status, "OVERDUE");
  assert.equal(late?.daysOverdue, 12);
  assert.deepEqual(result.invoices.map((row) => row.status), ["OVERDUE", "OVERDUE", "OVERDUE"]);
});

test("DEMO-3 liste : filtres par statut", async () => {
  for (const [status, expected] of [["PENDING", ["F-1042"]], ["PAID", ["F-1031"]]] as const) {
    const result = await listCompanyInvoices("company_a", { status, now: NOW }, seed() as never);
    assert.deepEqual(result.invoices.map((row) => row.reference), expected, status);
  }
});

test("DEMO-3 liste : client, commande, dernière relance et droit de relancer", async () => {
  const result = await listCompanyInvoices("company_a", { status: "ALL", now: NOW }, seed() as never);
  const byId = Object.fromEntries(result.invoices.map((row) => [row.id, row]));

  assert.equal(byId.pending?.customerName, "Studio Oberkampf");
  assert.equal(byId.pending?.orderReference, "CMD-1042");
  assert.equal(byId.pending?.amount, 45);
  assert.equal(byId.pending?.daysOverdue, 0);
  assert.equal(byId.pending?.canRemind, true);
  assert.equal(byId.paid?.canRemind, false, "payée");
  assert.equal(byId.late_reminded?.lastReminder?.result, "SENT");
  assert.equal(byId.late_reminded?.canRemind, false, "relancée il y a 2 h");
  assert.equal(byId.late_failed?.lastReminder?.result, "FAILED", "échec d'envoi visible");
  assert.equal(byId.late_failed?.canRemind, true, "un échec d'envoi se relance");
  assert.equal(byId.late?.lastReminder, null);
});
