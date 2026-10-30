import assert from "node:assert/strict";
import test, { type TestContext } from "node:test";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "../src/services/prisma/client";
import { updateCompanyOrderStatus, getClientOrderStats, getCompanyOrderStats } from "../src/domains/order/order.service";
import { adminUpdateDelivery, getDriverStats } from "../src/domains/delivery/delivery.service";
import { updateOrderStatusSchema } from "../src/lib/validations/order";
import { adminUpdateDeliverySchema } from "../src/lib/validations/delivery";
import * as invoiceValidation from "../src/lib/validations/invoice";
import { proposeLegacyDeliveryRecovery } from "../src/domains/invoice/legacy-billing-recovery";
import { getStatusBucket, isDeliveredStatus } from "../src/lib/dashboard/period-stats";
import { filterMiniAdminPermissions } from "../src/lib/permissions/mini-admin";
import type * as invoiceService from "../src/domains/invoice/invoice.service";
import * as invoiceDue from "../src/domains/invoice/invoice-due";

function replace(t: TestContext, target: object, key: string, fn: unknown) {
  const original = Reflect.get(target, key); Reflect.set(target, key, fn);
  t.after(() => { Reflect.set(target, key, original); });
}
function load<T>(file: string, deps: Record<string, unknown>): T {
  const sandboxModule = { exports: {} };
  runInNewContext(ts.transpileModule(readFileSync(file, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText,
    { Date, Math, Error, Promise, console, module: sandboxModule, exports: sandboxModule.exports, require: (id: string) => { assert.ok(id in deps, id); return deps[id]; } });
  return sandboxModule.exports as T;
}
const input = invoiceValidation.createOrderInvoiceSchema.parse({ customLines: [{ label: "Livraison", amount: 12 }] });
function fixture(status = "DELIVERED") {
  const date = new Date();
  const delivery = { id: "delivery", status, completedAt: status === "DELIVERED" ? date : null, missionStartedAt: date, missionAcceptedAt: date, updatedAt: date, driverId: "driver" };
  const order = { id: "order", status, updatedAt: date, customerId: null, shippingPostalCode: null, items: [], invoices: [] };
  let invoice: Record<string, unknown> | null = null;
  let events = 0;
  const tx = {
    $queryRaw: async () => [],
    invoice: {
      findMany: async () => invoice ? [invoice] : [],
      create: async ({ data }: { data: Record<string, unknown> }) => (invoice = { id: "invoice", updatedAt: date, ...data }),
      update: async ({ data }: { data: Record<string, unknown> }) => (invoice = { ...invoice, ...data }),
      findFirst: async ({ where }: { where: Record<string, unknown> }) => invoice && Object.entries(where).every(([k,v])=>invoice?.[k]===v) ? invoice : null,
      updateMany: async ({ where, data }: { where: Record<string, unknown>; data: Record<string, unknown> }) => {
        if (!invoice || !Object.entries(where).every(([k,v])=>k === "updatedAt" ? +(invoice?.[k] as Date) === +(v as Date) : v && typeof v === "object" && "in" in v ? (v.in as unknown[]).includes(invoice?.[k]) : invoice?.[k] === v)) return { count: 0 };
        invoice = { ...invoice, ...data }; return { count: 1 };
      },
      findUniqueOrThrow: async () => invoice,
    },
    order: { update: async () => assert.fail("la facture ne doit pas écrire la commande") },
    delivery: { update: async () => assert.fail("la facture ne doit pas écrire la livraison") },
    trackingEvent: { create: async () => { events++; } },
  };
  const service = load<typeof invoiceService>("src/domains/invoice/invoice.service.ts", {
    "@prisma/client": { Prisma },
    "@/services/prisma/client": { prisma: { order: { findFirst: async () => order }, $transaction: async (fn: (t: typeof tx) => unknown) => fn(tx) } },
    "@/domains/company/tariff-settings.service": { getCompanyTariffSettings: async () => ({ tariffZones: [], tariffFees: [] }) },
    "@/domains/company/billing-settings.service": { getCompanyBillingSettings: async () => ({ invoice: { vatRate: 0, defaultDueDays: 30, referencePrefix: "TEST" } }) },
    "@/lib/query/list-limits": {},
    "@/domains/client-portal/notify.service": { queueInvoiceIssuedNotification: async () => null },
    "@/domains/operations/operation-job.service": { kickOperationJob: () => {} },
    "@/domains/invoice/invoice-due": invoiceDue,
  });
  return { service, delivery, order, invoice: () => invoice!, events: () => events };
}
for (const status of ["ASSIGNED", "IN_DELIVERY", "DELIVERED", "FAILED"]) {
  test(`BILL : émission/réémission ${status}, mission et dates inchangées`, async () => {
    const f = fixture(status); const before = JSON.stringify({ delivery: f.delivery, order: f.order });
    const first = await f.service.createOrderInvoice("company", "order", input);
    const second = await f.service.createOrderInvoice("company", "order", input);
    assert.equal(first?.id, second?.id); assert.equal(f.invoice().status, "PENDING");
    assert.equal(JSON.stringify({ delivery: f.delivery, order: f.order }), before); assert.equal(f.events(), 0);
  });
}
test("BILL : règlement isolé, date stable au rejeu et refus de version périmée/entreprise étrangère", async () => {
  const f = fixture(); await f.service.createOrderInvoice("company", "order", input);
  const before = JSON.stringify({ delivery: f.delivery, order: f.order });
  assert.equal(await f.service.markOrderInvoicePaid("foreign", "order", "invoice", new Date()), null);
  await assert.rejects(f.service.markOrderInvoicePaid("company", "order", "invoice", new Date(0)), /INVOICE_STATUS_CONFLICT/);
  await f.service.markOrderInvoicePaid("company", "order", "invoice", f.invoice().updatedAt as Date);
  const paidAt = f.invoice().paidAt;
  await f.service.markOrderInvoicePaid("company", "order", "invoice", new Date(0));
  assert.equal(f.invoice().paidAt, paidAt); assert.equal(f.invoice().status, "PAID");
  assert.equal(JSON.stringify({ delivery: f.delivery, order: f.order }), before);
  await assert.rejects(f.service.createOrderInvoice("company", "order", input), /INVOICE_ALREADY_PAID/);
});
test("BILL : les écritures génériques refusent facturation et paiement avant tout accès DB", async () => {
  for (const status of ["INVOICED", "PAID"] as const) {
    assert.equal(updateOrderStatusSchema.safeParse({ status }).success, false);
    assert.equal(adminUpdateDeliverySchema.safeParse({ status }).success, false);
    await assert.rejects(updateCompanyOrderStatus("c", "o", status), /BILLING_STATUS_NOT_LOGISTICS/);
    await assert.rejects(adminUpdateDelivery("c", "d", { status }), /BILLING_STATUS_NOT_LOGISTICS/);
  }
});
test("BILL : permissions dédiées émission et règlement ; commandes seules refusées", async () => {
  let permissions = filterMiniAdminPermissions(["orders:update", "invoices:create", "invoices:update"], { miniAdmin: { modules: ["orders"] } });
  let calls = 0;
  const route = load<{POST: (r: Request, p: {params: Promise<{id: string}>}) => Promise<Response>; PATCH: (r: Request, p: {params: Promise<{id: string}>}) => Promise<Response>}>("src/app/api/orders/[id]/invoice/route.ts", {
    "next/server": { NextResponse },
    "@/lib/api/auth-guard": { requireStaffRole: async (permission: string) => permissions.includes(permission) ? { context: {} } : { error: NextResponse.json({}, { status: 403 }) }, requireRole: () => null, getCompanyId: () => "company" },
    "@/domains/invoice/invoice.service": { createOrderInvoice: async () => { calls++; return {}; }, markOrderInvoicePaid: async () => { calls++; return {}; } },
    "@/lib/config-messages": { zodIssueMessage: (e: { issues: Array<{ message: string }> }, f: string) => e.issues[0]?.message ?? f },
    "@/lib/validations/invoice": invoiceValidation,
  });
  const request = (body: unknown) => new Request("http://test", { method: "POST", body: JSON.stringify(body) });
  const params = { params: Promise.resolve({ id: "order" }) };
  assert.equal((await route.POST(request(input), params)).status, 403);
  assert.equal((await route.PATCH(request({ invoiceId: "i", expectedUpdatedAt: new Date().toISOString() }), params)).status, 403);
  assert.equal(calls, 0);
  permissions = ["invoices:create", "invoices:update"];
  assert.equal((await route.POST(request(input), params)).status, 200);
  assert.equal((await route.PATCH(request({ invoiceId: "i", expectedUpdatedAt: new Date().toISOString() }), params)).status, 200);
  assert.equal(calls, 2);
});
test("BILL : compteurs client, chauffeur et admin stables ; clôture ancienne exclue du mois courant", async (t) => {
  const f = fixture();
  const matches = (where: Record<string, unknown>, row: Record<string, unknown>): boolean => Object.entries(where).every(([key, value]) => {
    if (key === "OR") return (value as Record<string, unknown>[]).some((part) => matches(part, row));
    if (!["status", "completedAt", "updatedAt"].includes(key)) return true;
    if (value && typeof value === "object" && "in" in value) return (value.in as unknown[]).includes(row[key]);
    if (value && typeof value === "object" && "gte" in value) return row[key] != null && +(row[key] as Date) >= +(value.gte as Date);
    return row[key] === value;
  });
  replace(t, prisma.order, "count", async ({where}: {where: Record<string, unknown>}) => matches(where, f.order) ? 1 : 0);
  replace(t, prisma.delivery, "count", async ({where}: {where: Record<string, unknown>}) => matches(where, f.delivery) ? 1 : 0);
  replace(t, prisma.order, "groupBy", async ({where}: {where: Record<string, unknown>}) => matches(where, f.order) ? [{ status: f.order.status, _count: { _all: 1 } }] : []);
  replace(t, prisma.delivery, "groupBy", async ({where}: {where: Record<string, unknown>}) => matches(where, f.delivery) ? [{ status: f.delivery.status, _count: { _all: 1 } }] : []);
  replace(t, prisma.delivery, "findFirst", async () => null);
  replace(t, prisma.order, "findFirst", async () => null);
  const stats = () => Promise.all([getClientOrderStats("client", "company"), getDriverStats("driver"), getCompanyOrderStats("company")]);
  const before = await stats(); assert.equal(before[0].deliveredThisMonth, 1); assert.equal(before[1].deliveredToday, 1); assert.equal(before[2].deliveredToday, 1);
  await f.service.createOrderInvoice("company", "order", input); assert.deepEqual(await stats(), before);
  await f.service.markOrderInvoicePaid("company", "order", "invoice", f.invoice().updatedAt as Date); assert.deepEqual(await stats(), before);
  f.delivery.completedAt = new Date(2000, 0, 1); // updatedAt reste aujourd’hui : il ne doit pas servir de date de livraison.
  assert.equal((await stats())[0].deliveredThisMonth, 0);
  assert.equal(isDeliveredStatus("INVOICED"), false); assert.equal(getStatusBucket("PAID"), null);
});
test("BILL : reprise historique conservatrice, sans date fabriquée ni mutation", () => {
  const completedAt = new Date("2026-09-01");
  const row = { status: "INVOICED" as const, completedAt, podOutcome: "SUCCESS", trackingEvents: [{label:"Livré", occurredAt:completedAt}, {label:"Facturé", occurredAt:new Date()}] };
  const before = JSON.stringify(row); const result = proposeLegacyDeliveryRecovery(row);
  assert.equal(result.candidateStatus, "DELIVERED"); assert.equal(result.completedAt, completedAt); assert.equal(result.reviewRequired, true); assert.equal(JSON.stringify(row), before);
  assert.equal(proposeLegacyDeliveryRecovery({...row, completedAt:null}).candidateStatus, null);
  assert.equal(proposeLegacyDeliveryRecovery({...row, podOutcome:"FAILED"}).candidateStatus, null);
  assert.equal(proposeLegacyDeliveryRecovery({...row, trackingEvents:[]}).candidateStatus, null);
  assert.equal(proposeLegacyDeliveryRecovery({...row, podOutcome:"FAILED", trackingEvents:[{label:"Échec de livraison",occurredAt:completedAt}]}).candidateStatus,"FAILED");
  const active = proposeLegacyDeliveryRecovery({...row, completedAt:null,podOutcome:null,trackingEvents:[{label:"En livraison",occurredAt:completedAt}]});
  assert.equal(active.candidateStatus,"IN_DELIVERY"); assert.equal(active.completedAt,null); assert.equal(active.reviewRequired,true);
});
