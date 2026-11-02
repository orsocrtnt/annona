import assert from "node:assert/strict";
import test, { type TestContext } from "node:test";
import { prisma } from "../src/services/prisma/client";
import { parseBillingSettings } from "../src/domains/company/billing-settings.service";
import { companyBillingSettingsSchema, DEFAULT_BILLING_SETTINGS } from "../src/lib/validations/billing-settings";
import {
  queueDeliveryInvoiceJob,
  runDeliveryInvoiceJob,
} from "../src/domains/invoice/delivery-invoice.service";
import { createDeliveredOrderInvoice, createOrderInvoice } from "../src/domains/invoice/invoice.service";
import { updateDeliveryStatusByDriver, adminUpdateDelivery } from "../src/domains/delivery/delivery.service";
let invoiceNumber = 0;
import { updateCompanyOrderStatus } from "../src/domains/order/order.service";

type Row = Record<string, unknown>;

function replace(t: TestContext, target: object, key: string, value: unknown) {
  const hadOwn = Object.prototype.hasOwnProperty.call(target, key);
  const previous = Reflect.get(target, key);
  Reflect.set(target, key, value);
  t.after(() => {
    if (hadOwn) Reflect.set(target, key, previous);
    else Reflect.deleteProperty(target, key);
  });
}

const ZONE = { id: "zone_paris", name: "Paris", postalCodePrefixes: ["75"], price: 12.5 };

function settings(autoInvoiceOnDelivery: boolean | undefined) {
  return {
    tariffZones: [ZONE],
    tariffFees: [],
    billing: {
      invoice: {
        vatRate: 20,
        defaultDueDays: 30,
        referencePrefix: "FAC",
        footerNote: "",
        ...(autoInvoiceOnDelivery === undefined ? {} : { autoInvoiceOnDelivery }),
      },
    },
  };
}

/** Base simulée : commandes, factures, tâches durables, entreprises ; transactions sérialisées. */
function fakeDatabase(t: TestContext, options: {
  autoInvoiceOnDelivery?: boolean;
  order?: Partial<Row>;
  invoices?: Row[];
  delivery?: Partial<Row>;
} = {}) {
  const company = { id: "company_a", name: "Coursiers A", settings: settings(options.autoInvoiceOnDelivery) };
  const order: Row = {
    id: "order_1",
    companyId: "company_a",
    reference: "CMD-1042",
    status: "DELIVERED",
    deliveryCategory: "STANDARD",
    shippingPostalCode: "75011",
    customerId: "client_a",
    items: [],
    stops: [],
    ...options.order,
  };
  const delivery: Row = {
    id: "delivery_1",
    reference: "LIV-1042",
    companyId: "company_a",
    orderId: "order_1",
    driverId: "driver_1",
    customerId: "client_a",
    status: "IN_DELIVERY",
    deliveryCategory: "STANDARD",
    missionStartedAt: new Date("2026-10-28T08:00:00.000Z"),
    completedAt: null,
    updatedAt: new Date("2026-10-28T08:30:00.000Z"),
    ...options.delivery,
  };
  order.deliveries = [delivery];
  const invoices: Row[] = options.invoices ?? [];
  const jobs: Row[] = [];
  const outOfRangeNotes: Row[] = [];
  let sequence = 0;
  let queue: Promise<unknown> = Promise.resolve();

  const db = {
    $queryRaw: async (strings: TemplateStringsArray) => strings.join("").includes("invoice_counters") ? [{ last_number: ++invoiceNumber }] : [],
    $transaction: async (fn: (tx: unknown) => Promise<unknown>) => {
      const run = queue.then(() => fn(db));
      queue = run.catch(() => undefined);
      return run;
    },
    company: {
      findUnique: async ({ where }: { where: Row }) => (where.id === company.id ? { ...company } : null),
    },
    order: {
      findFirst: async ({ where, include }: { where: Row; include?: { invoices?: { where?: { status?: { not: string } } } } }) => {
        if (where.id !== order.id || where.companyId !== order.companyId) return null;
        const excluded = include?.invoices?.where?.status?.not;
        return { ...order, invoices: invoices.filter((row) => row.orderId === order.id && row.status !== excluded) };
      },
      findUniqueOrThrow: async () => ({ ...order }),
      updateMany: async ({ where, data }: { where: Row; data: Row }) => {
        if (where.status !== undefined && where.status !== order.status) return { count: 0 };
        Object.assign(order, data);
        return { count: 1 };
      },
    },
    delivery: {
      findFirst: async () => ({ ...delivery, order: { ...order } }),
      findUnique: async () => ({ ...delivery, order: { ...order, items: [] } }),
      update: async ({ data }: { data: Row }) => Object.assign(delivery, data),
      updateMany: async ({ where, data }: { where: Row; data: Row }) => {
        if (where.status !== undefined && where.status !== delivery.status) return { count: 0 };
        Object.assign(delivery, data);
        return { count: 1 };
      },
    },
    driverLocation: { findUnique: async () => null },
    trackingEvent: { create: async () => ({ id: `evt_${++sequence}` }) },
    // MOB-01C : une étape confirmée hors zone laisse une note interne d'incident.
    orderMessage: { create: async ({ data }: { data: Row }) => { outOfRangeNotes.push(data); return { id: `msg_${++sequence}`, ...data }; } },
    invoice: {
      findMany: async ({ where }: { where: Row }) => invoices.filter((row) =>
        row.orderId === where.orderId
        && (where.status === undefined || (row.status !== (where.status as { not: string }).not))),
      create: async ({ data }: { data: Row }) => {
        const row = { id: `inv_${++sequence}`, ...data };
        invoices.push(row);
        return { ...row };
      },
      update: async ({ where, data }: { where: Row; data: Row }) => {
        const row = invoices.find((candidate) => candidate.id === where.id)!;
        Object.assign(row, data);
        return { ...row };
      },
    },
    operationJob: {
      upsert: async ({ where, create }: { where: Row; create: Row }) => {
        let job = jobs.find((candidate) => candidate.jobKey === where.jobKey);
        if (!job) {
          job = { id: `job_${++sequence}`, status: "PENDING", ...create };
          jobs.push(job);
        }
        return { id: job.id, jobKey: job.jobKey, status: job.status };
      },
      // Le lancement immédiat (hors requête) relit la tâche : on la laisse au filet cron.
      findUnique: async () => null,
    },
  };
  for (const key of ["$queryRaw", "$transaction", "company", "order", "delivery", "driverLocation", "trackingEvent", "orderMessage", "invoice", "operationJob"]) {
    replace(t, prisma, key, (db as Row)[key]);
  }
  replace(t, console, "error", () => undefined);
  return { db, order, delivery, invoices, jobs, company };
}

const invoiceJobs = (jobs: Row[]) => jobs.filter((job) => String(job.jobKey).startsWith("delivery-invoice:"));

test("DEMO-3 réglage : la facture à la livraison est désactivée par défaut", () => {
  assert.equal(parseBillingSettings({}).invoice.autoInvoiceOnDelivery, false);
  assert.equal(parseBillingSettings(undefined).invoice.autoInvoiceOnDelivery, false);
  assert.equal(DEFAULT_BILLING_SETTINGS.invoice.autoInvoiceOnDelivery, false);
  const withoutFlag: Partial<typeof DEFAULT_BILLING_SETTINGS.invoice> = { ...DEFAULT_BILLING_SETTINGS.invoice };
  delete withoutFlag.autoInvoiceOnDelivery;
  assert.equal(companyBillingSettingsSchema.parse({ ...DEFAULT_BILLING_SETTINGS, invoice: withoutFlag }).invoice.autoInvoiceOnDelivery, false);
  assert.equal(companyBillingSettingsSchema.parse({ ...DEFAULT_BILLING_SETTINGS, invoice: { ...withoutFlag, autoInvoiceOnDelivery: true } }).invoice.autoInvoiceOnDelivery, true);
});

test("DEMO-3 file : réglage désactivé, aucune tâche ; activé, une tâche par passage en « Livrée »", async (t) => {
  const off = fakeDatabase(t);
  assert.equal(await queueDeliveryInvoiceJob(off.db as never, { companyId: "company_a", orderId: "order_1", passageKey: "evt_1" }), null);
  assert.equal(off.jobs.length, 0);

  const on = fakeDatabase(t, { autoInvoiceOnDelivery: true });
  const first = await queueDeliveryInvoiceJob(on.db as never, { companyId: "company_a", orderId: "order_1", passageKey: "evt_1" });
  const replay = await queueDeliveryInvoiceJob(on.db as never, { companyId: "company_a", orderId: "order_1", passageKey: "evt_1" });
  assert.equal(first?.id, replay?.id, "rejeu du même passage : même tâche");
  assert.equal(on.jobs.length, 1);
  assert.equal(on.jobs[0]!.jobKey, "delivery-invoice:order_1:evt_1");
  await queueDeliveryInvoiceJob(on.db as never, { companyId: "company_a", orderId: "order_1", passageKey: "evt_2" });
  assert.equal(on.jobs.length, 2, "nouveau passage : nouvelle tâche");
  assert.equal(on.jobs[0]!.type, "DELIVERY_INVOICE", "type de tâche dédié");
  assert.deepEqual(on.jobs[0]!.payload, { orderId: "order_1", companyId: "company_a" });
});

test("DEMO-3 génération : commande livrée, une facture émise avec zone, TVA, échéance et e-mail existant", async (t) => {
  const { invoices, jobs } = fakeDatabase(t, { autoInvoiceOnDelivery: true });
  const before = Date.now();

  const result = await createDeliveredOrderInvoice("company_a", "order_1");

  assert.equal(result.status, "created");
  assert.equal(invoices.length, 1);
  const invoice = invoices[0]!;
  assert.equal(invoice.status, "PENDING");
  assert.equal(invoice.amount, 15);
  assert.deepEqual((invoice.lineItems as Row[]).map((line) => line.sourceType), ["ZONE", "VAT"]);
  assert.equal(invoice.customerId, "client_a");
  const dueInDays = ((invoice.dueDate as Date).getTime() - before) / 86_400_000;
  assert.ok(dueInDays > 29.9 && dueInDays < 30.1, "délai de paiement de l'entreprise");
  assert.ok(jobs.some((job) => job.jobKey === `client-notification:invoice:${invoice.id}:issued`), "e-mail « Nouvelle facture » réutilisé");
});

test("DEMO-3 génération : achats validés par le livreur repris quand il n'y a pas de zone", async (t) => {
  const { invoices } = fakeDatabase(t, {
    autoInvoiceOnDelivery: true,
    order: { shippingPostalCode: "69001", items: [{ name: "Pain", quantity: 2, unitPrice: 1.5 }] },
  });
  assert.equal((await createDeliveredOrderInvoice("company_a", "order_1")).status, "created");
  assert.deepEqual((invoices[0]!.lineItems as Row[]).map((line) => line.sourceType), ["PURCHASE", "VAT"]);
});

test("DEMO-3 génération : rejeu et course entre deux traitements ne créent qu'une facture", async (t) => {
  const { invoices } = fakeDatabase(t, { autoInvoiceOnDelivery: true });
  const results = await Promise.all([
    createDeliveredOrderInvoice("company_a", "order_1"),
    createDeliveredOrderInvoice("company_a", "order_1"),
  ]);
  const replay = await createDeliveredOrderInvoice("company_a", "order_1");

  assert.deepEqual(results.map((result) => result.status).sort(), ["created", "skipped"]);
  assert.deepEqual(replay, { status: "skipped", reason: "INVOICE_EXISTS" });
  assert.equal(invoices.length, 1);
});

test("DEMO-3 génération : une facture saisie à la main n'est jamais doublée ni modifiée", async (t) => {
  const manual = { id: "manual", orderId: "order_1", status: "PENDING", amount: 99 };
  const { invoices } = fakeDatabase(t, { autoInvoiceOnDelivery: true, invoices: [manual] });
  assert.deepEqual(await createDeliveredOrderInvoice("company_a", "order_1"), { status: "skipped", reason: "INVOICE_EXISTS" });
  assert.equal(invoices.length, 1);
  assert.equal(invoices[0]!.amount, 99);
});

test("DEMO-3 génération : une facture annulée ne bloque pas, comme le flux manuel", async (t) => {
  const cancelled = { id: "cancelled", orderId: "order_1", status: "CANCELLED", amount: 99, reference: "FAC-OLD" };
  const { invoices } = fakeDatabase(t, { autoInvoiceOnDelivery: true, invoices: [cancelled] });
  assert.equal((await createDeliveredOrderInvoice("company_a", "order_1")).status, "created");
  assert.equal(invoices.length, 2);
  assert.equal(invoices[0]!.status, "CANCELLED", "l'annulée reste annulée");
  assert.equal(invoices[1]!.status, "PENDING");
  assert.notEqual(invoices[1]!.reference, "FAC-OLD", "référence unique");
});

test("DEMO-3 génération : réglage coupé entre la livraison et le traitement, rien n'est créé", async (t) => {
  const { invoices } = fakeDatabase(t, { autoInvoiceOnDelivery: false });
  assert.deepEqual(await createDeliveredOrderInvoice("company_a", "order_1"), { status: "skipped", reason: "SETTING_DISABLED" });
  assert.equal(invoices.length, 0);
});

test("DEMO-3 génération : livraison échouée ou commande d'une autre entreprise, aucune facture", async (t) => {
  const failed = fakeDatabase(t, { autoInvoiceOnDelivery: true, order: { status: "FAILED" } });
  assert.deepEqual(await createDeliveredOrderInvoice("company_a", "order_1"), { status: "skipped", reason: "ORDER_NOT_DELIVERED" });
  assert.equal(failed.invoices.length, 0);

  const foreign = fakeDatabase(t, { autoInvoiceOnDelivery: true });
  assert.deepEqual(await createDeliveredOrderInvoice("company_b", "order_1"), { status: "skipped", reason: "ORDER_NOT_FOUND" });
  assert.equal(foreign.invoices.length, 0);
});

test("DEMO-3 génération : sans zone ni achat, l'erreur est explicite (tâche en échec visible)", async (t) => {
  const { invoices } = fakeDatabase(t, { autoInvoiceOnDelivery: true, order: { shippingPostalCode: "69001" } });
  await assert.rejects(createDeliveredOrderInvoice("company_a", "order_1"), (error: Error & { permanent?: boolean }) =>
    error.message === "DELIVERY_INVOICE_EMPTY" && error.permanent === true);
  assert.equal(invoices.length, 0);
});

test("DEMO-3 génération : client sans compte, la facture est émise sans e-mail", async (t) => {
  const { invoices, jobs } = fakeDatabase(t, { autoInvoiceOnDelivery: true, order: { customerId: null } });
  assert.equal((await createDeliveredOrderInvoice("company_a", "order_1")).status, "created");
  assert.equal(invoices.length, 1);
  assert.equal(jobs.some((job) => String(job.jobKey).includes(":issued")), false);
});

test("DEMO-3 tâche : charge utile contrôlée, entreprise et commande transmises", async (t) => {
  const { invoices } = fakeDatabase(t, { autoInvoiceOnDelivery: true });
  await assert.rejects(runDeliveryInvoiceJob({}), (error: Error & { permanent?: boolean }) =>
    error.message === "DELIVERY_INVOICE_PAYLOAD_INVALID" && error.permanent === true);
  await runDeliveryInvoiceJob({ orderId: "order_1", companyId: "company_a" });
  assert.equal(invoices.length, 1);
});

test("DEMO-3 facturation manuelle : une facture en retard réémise est mise à jour, pas doublée", async (t) => {
  const late = { id: "late", reference: "FAC-OLD", orderId: "order_1", status: "OVERDUE", amount: 10, customerId: "client_a" };
  const { invoices } = fakeDatabase(t, { invoices: [late] });
  const invoice = await createOrderInvoice("company_a", "order_1", { zoneId: ZONE.id, feeIds: [], includePurchases: false, customLines: [] });
  assert.equal(invoice?.id, "late");
  assert.equal(invoices.length, 1);
  assert.equal(invoices[0]!.status, "PENDING");
});

test("DEMO-3 livreur : le passage en « Livrée » met la facture en file, sans l'émettre dans la transition", async (t) => {
  const { jobs, invoices, delivery } = fakeDatabase(t, { autoInvoiceOnDelivery: true, order: { status: "IN_DELIVERY" } });

  const updated = await updateDeliveryStatusByDriver("driver_1", "delivery_1", "DELIVERED", {
    podPhotoPath: "pod/photo.jpg",
    confirmOutOfRange: true,
    latitude: 48.85,
    longitude: 2.35,
  });

  assert.ok(updated);
  assert.equal(delivery.status, "DELIVERED");
  assert.equal(invoiceJobs(jobs).length, 1);
  assert.equal(invoices.length, 0, "la facture est créée par la tâche, pas dans la transition du livreur");
});

test("DEMO-3 livreur : livraison échouée ou réglage désactivé, aucune tâche de facture", async (t) => {
  const failed = fakeDatabase(t, { autoInvoiceOnDelivery: true, order: { status: "IN_DELIVERY" } });
  await updateDeliveryStatusByDriver("driver_1", "delivery_1", "FAILED", { podFailureCode: "ABSENT" as never, confirmOutOfRange: true, latitude: 1, longitude: 1 });
  assert.equal(invoiceJobs(failed.jobs).length, 0);

  const off = fakeDatabase(t, { order: { status: "IN_DELIVERY" } });
  await updateDeliveryStatusByDriver("driver_1", "delivery_1", "DELIVERED", { podPhotoPath: "p.jpg", confirmOutOfRange: true, latitude: 1, longitude: 1 });
  assert.equal(off.delivery.status, "DELIVERED");
  assert.equal(invoiceJobs(off.jobs).length, 0);
});

test("DEMO-3 administrateur : deux passages simultanés en « Livrée », deux tâches, une seule facture", async (t) => {
  const { jobs, delivery, order, invoices } = fakeDatabase(t, { autoInvoiceOnDelivery: true, order: { status: "IN_DELIVERY" } });
  await adminUpdateDelivery("company_a", "delivery_1", { status: "DELIVERED" } as never);
  assert.equal(delivery.status, "DELIVERED");
  order.status = "DELIVERED";
  await adminUpdateDelivery("company_a", "delivery_1", { status: "DELIVERED" } as never);
  assert.equal(invoiceJobs(jobs).length, 2);
  assert.notEqual(invoiceJobs(jobs)[0]!.jobKey, invoiceJobs(jobs)[1]!.jobKey);

  const results = await Promise.all(invoiceJobs(jobs).map((job) => runDeliveryInvoiceJob(job.payload as never)));
  assert.deepEqual(results.map((result) => result.status).sort(), ["created", "skipped"]);
  assert.equal(invoices.length, 1, "le contrôle sous verrou garantit une seule facture active");
});

test("DEMO-3 génération : après un passage ignoré, un nouveau passage en « Livrée » crée la facture", async (t) => {
  const manual = { id: "manual", orderId: "order_1", status: "PENDING", amount: 99, reference: "FAC-MAN" };
  const { jobs, order, invoices } = fakeDatabase(t, { autoInvoiceOnDelivery: true, invoices: [manual], order: { status: "IN_DELIVERY" } });
  await updateCompanyOrderStatus("company_a", "order_1", "DELIVERED");
  assert.deepEqual(await runDeliveryInvoiceJob(invoiceJobs(jobs)[0]!.payload as never), { status: "skipped", reason: "INVOICE_EXISTS" });

  manual.status = "CANCELLED"; // facture manuelle annulée, commande remise en cours puis relivrée
  order.status = "IN_DELIVERY";
  await updateCompanyOrderStatus("company_a", "order_1", "DELIVERED");
  assert.equal(invoiceJobs(jobs).length, 2);
  assert.equal((await runDeliveryInvoiceJob(invoiceJobs(jobs)[1]!.payload as never)).status, "created");
  assert.equal(invoices.filter((row) => row.status !== "CANCELLED").length, 1);
});

test("DEMO-3 génération : facture automatique et facture manuelle simultanées, une seule facture active", async (t) => {
  const { invoices } = fakeDatabase(t, { autoInvoiceOnDelivery: true });
  await Promise.all([
    createDeliveredOrderInvoice("company_a", "order_1"),
    createOrderInvoice("company_a", "order_1", { zoneId: ZONE.id, feeIds: [], includePurchases: false, customLines: [] }),
  ]);
  assert.equal(invoices.filter((row) => row.status !== "CANCELLED").length, 1);
});

test("DEMO-3 administrateur : « Livrée » depuis la commande met la facture en file", async (t) => {
  const { jobs, order } = fakeDatabase(t, { autoInvoiceOnDelivery: true, order: { status: "IN_DELIVERY" } });
  await updateCompanyOrderStatus("company_a", "order_1", "DELIVERED");
  assert.equal(order.status, "DELIVERED");
  assert.equal(invoiceJobs(jobs).length, 1);
  assert.deepEqual(invoiceJobs(jobs)[0]!.payload, { orderId: "order_1", companyId: "company_a" });
});
