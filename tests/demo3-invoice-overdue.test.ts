import assert from "node:assert/strict";
import test, { type TestContext } from "node:test";
import { prisma } from "../src/services/prisma/client";
import {
  invoiceDaysOverdue,
  isInvoiceOutstanding,
  startOfParisDay,
} from "../src/domains/invoice/invoice-due";
import { markOverdueInvoices } from "../src/domains/invoice/invoice-overdue.service";
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
