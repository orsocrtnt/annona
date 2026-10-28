import assert from "node:assert/strict";
import test, { type TestContext } from "node:test";
import { prisma } from "../src/services/prisma/client";
import {
  invoiceDaysOverdue,
  isInvoiceOutstanding,
  startOfParisDay,
} from "../src/domains/invoice/invoice-due";
import { markOverdueInvoices } from "../src/domains/invoice/invoice-overdue.service";
import { markOrderInvoicePaid } from "../src/domains/invoice/invoice.service";
import { updateCompanyOrderStatus } from "../src/domains/order/order.service";
import { createInvoiceFakeDb, invoice } from "./helpers/invoice-fake-db";

// 28 octobre 2026, 11 h à Paris (heure d'hiver depuis le 25 octobre : UTC+1).
const NOW = new Date("2026-10-28T10:00:00.000Z");

function replaceMethod(t: TestContext, target: object, key: string, value: unknown) {
  const hadOwn = Object.prototype.hasOwnProperty.call(target, key);
  const previous = Reflect.get(target, key);
  Reflect.set(target, key, value);
  t.after(() => {
    if (hadOwn) Reflect.set(target, key, previous);
    else Reflect.deleteProperty(target, key);
  });
}

test("DEMO-3 échéance : le jour d'échéance se lit à Paris, minuit compris", () => {
  assert.equal(startOfParisDay(NOW).toISOString(), "2026-10-27T23:00:00.000Z");
  // Heure d'été : minuit à Paris = 22 h UTC la veille.
  assert.equal(startOfParisDay(new Date("2026-07-14T12:00:00.000Z")).toISOString(), "2026-07-13T22:00:00.000Z");
  // 23 h 30 UTC le 27 = 0 h 30 le 28 à Paris.
  assert.equal(startOfParisDay(new Date("2026-10-27T23:30:00.000Z")).toISOString(), "2026-10-27T23:00:00.000Z");
});

test("DEMO-3 échéance : nombre de jours de retard en jours calendaires de Paris", () => {
  assert.equal(invoiceDaysOverdue(new Date("2026-10-16T09:00:00.000Z"), NOW), 12, "échue le 16, 12 jours le 28");
  assert.equal(invoiceDaysOverdue(new Date("2026-10-27T22:59:00.000Z"), NOW), 1, "échue le 27 à 23 h 59 Paris");
  assert.equal(invoiceDaysOverdue(new Date("2026-10-28T20:00:00.000Z"), NOW), 0, "échue aujourd'hui : pas encore en retard");
  assert.equal(invoiceDaysOverdue(new Date("2026-11-05T09:00:00.000Z"), NOW), 0, "échéance future");
  assert.equal(invoiceDaysOverdue(null, NOW), 0, "échéance absente");
});

test("DEMO-3 échéance : seules les factures en attente ou en retard restent à régler", () => {
  assert.deepEqual(
    (["DRAFT", "PENDING", "PAID", "OVERDUE", "CANCELLED"] as const).filter(isInvoiceOutstanding),
    ["PENDING", "OVERDUE"]
  );
});

test("DEMO-3 retard : une facture en attente échue passe en retard, jamais les autres", async () => {
  const db = createInvoiceFakeDb({
    invoices: [
      invoice({ id: "late", dueDate: new Date("2026-10-16T09:00:00.000Z") }),
      invoice({ id: "due_today", dueDate: new Date("2026-10-28T08:00:00.000Z") }),
      invoice({ id: "paid_eve", status: "PAID", dueDate: new Date("2026-10-20T09:00:00.000Z"), paidAt: new Date("2026-10-19T09:00:00.000Z") }),
      invoice({ id: "cancelled", status: "CANCELLED" }),
      invoice({ id: "draft", status: "DRAFT" }),
      invoice({ id: "no_due", dueDate: null }),
      invoice({ id: "already", status: "OVERDUE" }),
    ],
  });

  const count = await markOverdueInvoices({ now: NOW }, db as never);

  assert.equal(count, 1);
  const status = Object.fromEntries(db.invoices.map((row) => [row.id, row.status]));
  assert.deepEqual(status, {
    late: "OVERDUE",
    due_today: "PENDING",
    paid_eve: "PAID",
    cancelled: "CANCELLED",
    draft: "DRAFT",
    no_due: "PENDING",
    already: "OVERDUE",
  });
});

test("DEMO-3 retard : passage idempotent et limité à l'entreprise demandée", async () => {
  const db = createInvoiceFakeDb({
    invoices: [
      invoice({ id: "a", companyId: "company_a" }),
      invoice({ id: "b", companyId: "company_b" }),
    ],
  });

  assert.equal(await markOverdueInvoices({ now: NOW, companyId: "company_a" }, db as never), 1);
  assert.equal(await markOverdueInvoices({ now: NOW, companyId: "company_a" }, db as never), 0, "rejeu sans effet");
  assert.equal(db.invoices.find((row) => row.id === "b")?.status, "PENDING", "autre entreprise intacte");
  assert.equal(await markOverdueInvoices({ now: NOW }, db as never), 1, "le cron traite toutes les entreprises");
});

test("DEMO-3 retard : un paiement validé pendant le passage gagne (mise à jour conditionnelle)", async () => {
  const db = createInvoiceFakeDb({ invoices: [invoice({ id: "race" })] });
  // Le paiement est validé juste avant l'écriture : PostgreSQL réévalue la
  // condition sur la ligne verrouillée ; la facture payée ne doit pas être touchée.
  db.beforeRawUpdate = () => { db.invoices[0]!.status = "PAID"; };

  assert.equal(await markOverdueInvoices({ now: NOW }, db as never), 0);
  assert.equal(db.invoices[0]!.status, "PAID");
});

test("DEMO-3 retard : passage calculé par le système, sans toucher updated_at, en SQL paramétré", async () => {
  const before = new Date("2026-09-20T10:00:00.000Z");
  const db = createInvoiceFakeDb({ invoices: [invoice({ id: "late", updatedAt: before })] });

  assert.equal(await markOverdueInvoices({ now: NOW, companyId: "company_a" }, db as never), 1);

  assert.equal(db.invoices[0]!.status, "OVERDUE");
  assert.equal(db.invoices[0]!.updatedAt.getTime(), before.getTime(), "updated_at inchangé");
  const query = db.executed[0]!;
  assert.doesNotMatch(query.sql, /updated_at/);
  assert.deepEqual(query.values, [startOfParisDay(NOW), "company_a"], "valeurs passées en paramètres");
});

test("DEMO-3 retard : « Marquer payée » avec la version lue avant le passage réussit", async (t) => {
  const row = invoice({ id: "inv_late", orderId: "order_1" });
  const readBefore = row.updatedAt;
  const db = createInvoiceFakeDb({ invoices: [row] });
  await markOverdueInvoices({ now: NOW }, db as never);
  replaceMethod(t, prisma, "$transaction", db.$transaction);
  replaceMethod(t, prisma, "$queryRaw", db.$queryRaw);
  replaceMethod(t, prisma, "invoice", db.invoice);

  const paid = await markOrderInvoicePaid("company_a", "order_1", "inv_late", readBefore);
  assert.equal(paid?.status, "PAID");
});

test("DEMO-3 retard : passage en retard entre la lecture et le paiement, le paiement passe", async (t) => {
  const row = invoice({ id: "inv_race", orderId: "order_1" });
  const db = createInvoiceFakeDb({ invoices: [row] });
  const original = db.invoice.updateMany;
  db.invoice.updateMany = async (args) => {
    row.status = "OVERDUE"; // cron passé entre la lecture et la réclamation, updated_at intact
    return original(args);
  };
  replaceMethod(t, prisma, "$transaction", db.$transaction);
  replaceMethod(t, prisma, "$queryRaw", db.$queryRaw);
  replaceMethod(t, prisma, "invoice", db.invoice);

  const paid = await markOrderInvoicePaid("company_a", "order_1", "inv_race", row.updatedAt);
  assert.equal(paid?.status, "PAID");
});

test("DEMO-3 retard : une facture en retard reste payable depuis la fiche commande", async (t) => {
  const row = invoice({ id: "inv_late", status: "OVERDUE", orderId: "order_1" });
  const db = createInvoiceFakeDb({ invoices: [row] });
  replaceMethod(t, prisma, "$transaction", db.$transaction);
  replaceMethod(t, prisma, "$queryRaw", db.$queryRaw);
  replaceMethod(t, prisma, "invoice", db.invoice);

  const paid = await markOrderInvoicePaid("company_a", "order_1", "inv_late", row.updatedAt);

  assert.equal(paid?.status, "PAID");
  assert.ok(paid?.paidAt instanceof Date);
});

test("DEMO-3 retard : une facture annulée ou brouillon reste non payable", async (t) => {
  for (const status of ["CANCELLED", "DRAFT"] as const) {
    const row = invoice({ id: `inv_${status}`, status, orderId: "order_1" });
    const db = createInvoiceFakeDb({ invoices: [row] });
    replaceMethod(t, prisma, "$transaction", db.$transaction);
    replaceMethod(t, prisma, "$queryRaw", db.$queryRaw);
    replaceMethod(t, prisma, "invoice", db.invoice);
    await assert.rejects(markOrderInvoicePaid("company_a", "order_1", row.id, row.updatedAt), /INVOICE_NOT_PAYABLE/);
  }
});

test("DEMO-3 retard : annulation de commande quand la facture passe en retard pendant l'annulation", async (t) => {
  const updatedAt = new Date("2026-10-20T10:00:00.000Z");
  const row = { id: "inv_1", status: "PENDING", companyId: "company_a", orderId: "order_1", updatedAt };
  const order = { id: "order_1", companyId: "company_a", status: "PENDING", deliveryCategory: "STANDARD", customerId: "client_a", updatedAt, deliveries: [] as unknown[], invoices: [row] };
  const tx = {
    order: {
      findFirst: async () => ({ ...order, invoices: [{ ...row }] }),
      updateMany: async () => { order.status = "CANCELLED"; return { count: 1 }; },
    },
    invoice: {
      updateMany: async ({ where, data }: { where: Record<string, unknown>; data: Record<string, unknown> }) => {
        row.status = "OVERDUE"; // cron passé entre la lecture et la réclamation, updated_at intact
        const status = where.status as string | { in: string[] };
        const statusOk = typeof status === "string" ? status === row.status : status.in.includes(row.status);
        if (!statusOk || (where.updatedAt as Date).getTime() !== row.updatedAt.getTime()) return { count: 0 };
        Object.assign(row, data);
        return { count: 1 };
      },
      findFirst: async () => ({ status: row.status }),
    },
  };
  replaceMethod(t, prisma, "$transaction", async (fn: (client: unknown) => Promise<unknown>) => fn(tx));
  replaceMethod(t, prisma, "order", { ...tx.order, findFirst: async () => ({ ...order }) });

  const result = await updateCompanyOrderStatus("company_a", "order_1", "CANCELLED");
  assert.ok(result);
  assert.equal(row.status, "CANCELLED");
});
