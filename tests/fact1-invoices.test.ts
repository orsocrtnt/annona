/**
 * FACT-1 — factures par période (CLI-10, ADM-10, RG-06, RG-07, ENF-05, critère 9).
 * Base en mémoire (`helpers/memory-db.ts`) avec transactions sérialisées et annulables (comme PostgreSQL
 * sous les verrous `FOR UPDATE` du service) : regroupement par périodicité, bornes en heure de Paris et
 * changements d'heure, numérotation continue y compris en concurrence et après un échec, idempotence,
 * une commande sur une seule facture, règlements et statut, droits, isolation, Factur-X.
 */
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { ROLE_PERMISSIONS } from "../prisma/reference-data";
import {
  currentPeriod,
  isoWeek,
  isPeriodClosed,
  nextPeriod,
  periodContaining,
  periodLabel,
  periodShortLabel,
  previousPeriod,
  todayKey,
} from "../src/domains/invoice/billing-period";
import { buildInvoice } from "../src/domains/invoice/invoice-builder";
import {
  generateDueInvoices,
  generateInvoicesForPeriod,
  generateMerchantInvoice,
  type InvoiceGenerationDb,
  type InvoiceGenerationDeps,
} from "../src/domains/invoice/invoice-generation.service";
import { invoiceLegalGaps, invoiceLegalMentions } from "../src/domains/invoice/invoice-legal";
import { deletePayment, recordPayment, settlementStatus, type PaymentDb } from "../src/domains/invoice/invoice-payment.service";
import { emailStatusFromJob, getAdminInvoice, listAdminInvoices, listMerchantInvoices, type InvoiceQueryDb } from "../src/domains/invoice/invoice-query.service";
import { csvField } from "../src/domains/invoice/invoice-export.service";
import { invoiceEmailText } from "../src/domains/invoice/invoice-email.service";
import { mapInvoiceToFacturX, type FacturXSource } from "../src/domains/invoice/facturx/facturx-mapping";
import { buildFacturXPdf, facturXVisibleMentions } from "../src/domains/invoice/facturx/facturx-document";
import { correctAdminOrder, type AdminOrderDb } from "../src/domains/order/admin-order.service";
import { reportShortage, setOrderPrepared, type ProductionDb } from "../src/domains/production/production.service";
import { getPageAccessRule } from "../src/lib/permissions/page-access";
import type { EinvoicingSettings } from "../src/lib/validations/einvoicing";
import { generateInvoicePdf } from "../src/lib/pdf/invoice-pdf";
import { generateStatementPdf } from "../src/lib/pdf/statement-pdf";
import { createMemoryDb } from "./helpers/memory-db";
import { pdfText } from "./helpers/pdf-text";

type Row = Record<string, unknown>;
const PARIS = "Europe/Paris";
const day = (date: string) => new Date(`${date}T00:00:00.000Z`);
/** Lundi 9 novembre 2026, 7 h à Paris. */
const MONDAY = new Date("2026-11-09T06:00:00.000Z");

// ---------------------------------------------------------------------------
// Base en mémoire : transactions sérialisées, annulées en cas d'erreur
// ---------------------------------------------------------------------------

function transactional(tables: Record<string, Row[]>) {
  const db = createMemoryDb(tables) as Record<string, unknown>;
  let chain: Promise<unknown> = Promise.resolve();
  db.$transaction = (fn: (tx: unknown) => Promise<unknown>) => {
    const run = chain.then(async () => {
      const snapshot = structuredClone(tables);
      try {
        return await fn(db);
      } catch (error) {
        for (const key of Object.keys(tables)) delete tables[key];
        Object.assign(tables, snapshot);
        throw error;
      }
    });
    chain = run.catch(() => undefined);
    return run;
  };
  return db;
}

/** Compteur `invoice_counters` simulé dans les tables (annulé avec la transaction). */
function counterDeps(tables: Record<string, Row[]>, db: unknown, hook?: () => void): InvoiceGenerationDeps {
  return {
    db: db as InvoiceGenerationDb,
    kick: () => undefined,
    nextNumber: async (_tx, companyId) => {
      hook?.();
      const counters = (tables.invoiceCounter ??= []);
      let row = counters.find((counter) => counter.companyId === companyId);
      if (!row) {
        row = { companyId, lastNumber: 0 };
        counters.push(row);
      }
      row.lastNumber = (row.lastNumber as number) + 1;
      return row.lastNumber as number;
    },
  };
}

let orderSeq = 0;
function order(companyId: string, merchantId: string, date: string, status = "DELIVERED", extra: Row = {}) {
  orderSeq += 1;
  return { id: `o${orderSeq}`, companyId, merchantId, reference: `C-${orderSeq}`, deliveryDate: day(date), slotId: "s1", status, origin: "MANUAL", invoiceId: null, notes: null, ...extra };
}
function line(companyId: string, orderId: string, productId: string, ordered: number, delivered: number | null, price: number | null) {
  return { id: `l-${orderId}-${productId}`, companyId, orderId, productId, quantityOrdered: ordered, quantityDelivered: delivered, unitPriceFrozenCents: price };
}

function fixture() {
  orderSeq = 0;
  const tables: Record<string, Row[]> = {
    company: [
      { id: "A", status: "ACTIVE", timezone: PARIS, cutoffTime: "17:00", settings: { billing: { invoice: { referencePrefix: "FAC", defaultDueDays: 30 } } } },
      { id: "B", status: "ACTIVE", timezone: PARIS, cutoffTime: "17:00", settings: {} },
    ],
    merchant: [
      { id: "MD", companyId: "A", name: "Café Jour", tradeName: null, billingPeriod: "DAILY", billingEmail: "jour@test.fr", address: "1 rue", postalCode: "75011", city: "Paris" },
      { id: "MW", companyId: "A", name: "Bistrot Semaine", tradeName: null, billingPeriod: "WEEKLY", billingEmail: null, address: "2 rue", postalCode: "75011", city: "Paris" },
      { id: "MM", companyId: "A", name: "Hôtel Mois", tradeName: "Hôtel du Mois", billingPeriod: "MONTHLY", billingEmail: "mois@test.fr", address: "3 rue", postalCode: "75004", city: "Paris" },
      { id: "MB", companyId: "B", name: "Client B", tradeName: null, billingPeriod: "MONTHLY", billingEmail: null, address: "1 rue B", postalCode: "69001", city: "Lyon" },
    ],
    product: [
      { id: "baguette", companyId: "A", name: "Baguette", unit: "pièce", vatRateBasisPoints: 550 },
      { id: "croissant", companyId: "A", name: "Croissant", unit: "pièce", vatRateBasisPoints: 550 },
      { id: "sandwich", companyId: "A", name: "Sandwich", unit: "pièce", vatRateBasisPoints: 1000 },
      { id: "painB", companyId: "B", name: "Pain B", unit: "pièce", vatRateBasisPoints: 550 },
    ],
    order: [],
    orderLine: [],
    invoice: [],
    invoiceLine: [],
    payment: [],
    auditLog: [],
    operationJob: [],
    invoiceCounter: [],
    user: [{ id: "admin", companyId: "A", firstName: "Alice", lastName: "Admin" }],
  };
  const add = (o: Row, lines: Array<[string, number, number | null, number | null]>) => {
    tables.order!.push(o);
    for (const [productId, ordered, delivered, price] of lines) tables.orderLine!.push(line(o.companyId as string, o.id as string, productId, ordered, delivered, price));
    return o;
  };
  return { tables, add };
}

// ---------------------------------------------------------------------------
// Périodes (heure de Paris, changements d'heure)
// ---------------------------------------------------------------------------

test("CLI-10, ADM-10 : bornes jour, semaine ISO (lundi-dimanche), mois et année", () => {
  assert.deepEqual(periodContaining("DAILY", "2026-11-05"), { type: "DAILY", start: "2026-11-05", end: "2026-11-05" });
  assert.deepEqual(periodContaining("WEEKLY", "2026-11-05"), { type: "WEEKLY", start: "2026-11-02", end: "2026-11-08" });
  assert.deepEqual(periodContaining("WEEKLY", "2026-11-08"), { type: "WEEKLY", start: "2026-11-02", end: "2026-11-08" }, "le dimanche termine la semaine");
  assert.deepEqual(periodContaining("WEEKLY", "2026-11-09"), { type: "WEEKLY", start: "2026-11-09", end: "2026-11-15" }, "le lundi l'ouvre");
  // Semaine à cheval sur deux années : semaine 53 de 2026.
  assert.deepEqual(periodContaining("WEEKLY", "2027-01-01"), { type: "WEEKLY", start: "2026-12-28", end: "2027-01-03" });
  assert.deepEqual(isoWeek("2027-01-01"), { year: 2026, week: 53 });
  assert.deepEqual(isoWeek("2026-01-01"), { year: 2026, week: 1 });
  assert.deepEqual(periodContaining("MONTHLY", "2028-02-10"), { type: "MONTHLY", start: "2028-02-01", end: "2028-02-29" }, "année bissextile");
  assert.deepEqual(periodContaining("YEARLY", "2026-07-14"), { type: "YEARLY", start: "2026-01-01", end: "2026-12-31" });
  assert.deepEqual(previousPeriod(periodContaining("MONTHLY", "2026-03-15")), { type: "MONTHLY", start: "2026-02-01", end: "2026-02-28" });
  assert.deepEqual(nextPeriod(periodContaining("WEEKLY", "2026-12-30")), { type: "WEEKLY", start: "2027-01-04", end: "2027-01-10" });
  assert.equal(periodLabel(periodContaining("WEEKLY", "2026-11-05")), "Semaine 45 · du 2 novembre au 8 novembre 2026");
  assert.equal(periodLabel(periodContaining("MONTHLY", "2026-11-05")), "Novembre 2026");
  assert.equal(periodShortLabel(periodContaining("WEEKLY", "2027-01-01")), "Semaine 53 · 2026");
  assert.equal(periodShortLabel(periodContaining("DAILY", "2026-11-05")), "05/11/2026");
});

test("ADM-10 : « aujourd'hui » et la fin de période se lisent à Paris, changements d'heure compris", () => {
  // 23 h 30 UTC le 28 mars 2026 = 0 h 30 à Paris le 29 (jour du passage à l'heure d'été).
  assert.equal(todayKey(new Date("2026-03-28T23:30:00Z"), PARIS), "2026-03-29");
  assert.equal(todayKey(new Date("2026-03-28T22:59:00Z"), PARIS), "2026-03-28");
  // Heure d'été : minuit à Paris = 22 h UTC la veille (25 octobre 2026, retour à l'heure d'hiver).
  assert.equal(todayKey(new Date("2026-10-24T22:30:00Z"), PARIS), "2026-10-25");
  // Mois d'octobre (31 jours, 25 heures le 25) : terminé à minuit Paris, soit 23 h UTC le 31 en heure d'hiver.
  const october = periodContaining("MONTHLY", "2026-10-25");
  assert.equal(isPeriodClosed(october, new Date("2026-10-31T22:59:59Z"), PARIS), false);
  assert.equal(isPeriodClosed(october, new Date("2026-10-31T23:00:00Z"), PARIS), true);
  // Semaine : la semaine 13 de 2026 (23-29 mars, 167 heures) se termine dimanche 29 à minuit Paris (22 h UTC, heure d'été).
  const week13 = periodContaining("WEEKLY", "2026-03-29");
  assert.equal(isPeriodClosed(week13, new Date("2026-03-29T21:59:00Z"), PARIS), false);
  assert.equal(isPeriodClosed(week13, new Date("2026-03-29T22:00:00Z"), PARIS), true);
  assert.deepEqual(currentPeriod("DAILY", new Date("2026-11-08T23:30:00Z"), PARIS), { type: "DAILY", start: "2026-11-09", end: "2026-11-09" });
});

// ---------------------------------------------------------------------------
// Montants (RG-06, critère 9)
// ---------------------------------------------------------------------------

test("RG-06 : lignes regroupées par produit et prix, quantités livrées, TVA par taux, totaux en centimes", () => {
  const built = buildInvoice([
    { id: "o1", reference: "C-1", deliveryDate: "2026-11-03", lines: [
      { productId: "baguette", name: "Baguette", unit: "pièce", quantityOrdered: 40, quantityDelivered: 40, unitPriceFrozenCents: 110, vatRateBasisPoints: 550 },
      { productId: "sandwich", name: "Sandwich", unit: "pièce", quantityOrdered: 3, quantityDelivered: 3, unitPriceFrozenCents: 450, vatRateBasisPoints: 1000 },
    ] },
    { id: "o2", reference: "C-2", deliveryDate: "2026-11-04", lines: [
      { productId: "baguette", name: "Baguette", unit: "pièce", quantityOrdered: 40, quantityDelivered: 35, unitPriceFrozenCents: 110, vatRateBasisPoints: 550 },
      // Prix changé dans la période : ligne distincte.
      { productId: "croissant", name: "Croissant", unit: "pièce", quantityOrdered: 10, quantityDelivered: 0, unitPriceFrozenCents: 95, vatRateBasisPoints: 550 },
    ] },
    { id: "o3", reference: "C-3", deliveryDate: "2026-11-05", lines: [
      { productId: "baguette", name: "Baguette", unit: "pièce", quantityOrdered: 10, quantityDelivered: 10, unitPriceFrozenCents: 115, vatRateBasisPoints: 550 },
    ] },
  ]);
  assert.deepEqual(built.lines.map((l) => [l.label, l.quantity, l.unitPriceCents, l.totalCents]), [
    ["Baguette", 75, 110, 8250],
    ["Baguette", 10, 115, 1150],
    ["Sandwich", 3, 450, 1350],
  ], "manquant total (croissants à 0) : aucune ligne");
  assert.equal(built.subtotalCents, 10_750);
  // 9 400 × 5,5 % = 517 ; 1 350 × 10 % = 135.
  assert.deepEqual(built.vatBreakdown, [
    { vatRateBasisPoints: 550, baseCents: 9400, vatCents: 517 },
    { vatRateBasisPoints: 1000, baseCents: 1350, vatCents: 135 },
  ]);
  assert.equal(built.vatCents, 652);
  assert.equal(built.totalCents, 11_402);
  assert.deepEqual(built.orders.map((o) => [o.reference, o.subtotalCents]), [["C-1", 5750], ["C-2", 3850], ["C-3", 1150]]);
  const unpriced = buildInvoice([{ id: "o9", reference: "C-9", deliveryDate: "2026-11-03", lines: [{ productId: "x", name: "X", unit: null, quantityOrdered: 1, quantityDelivered: 1, unitPriceFrozenCents: null, vatRateBasisPoints: 550 }] }]);
  assert.deepEqual(unpriced.skipped, [{ id: "o9", reference: "C-9", reason: "PRICE_NOT_FROZEN" }]);
  assert.equal(unpriced.lines.length, 0);
});

test("Critère 9, BOU-06 : un manquant signalé par le boulanger réduit le montant facturé au commerçant", async () => {
  const { tables, add } = fixture();
  const full = add(order("A", "MD", "2026-11-05", "LOCKED"), [["baguette", 40, null, 110], ["croissant", 20, null, 95]]);
  const short = add(order("A", "MD", "2026-11-06", "LOCKED"), [["baguette", 40, null, 110], ["croissant", 20, null, 95]]);
  const db = transactional(tables);
  const baker = { companyId: "A", userId: "baker" };
  // Le boulanger signale 6 croissants manquants (14 livrés sur 20), puis les deux commandes sont préparées et livrées.
  const croissant = tables.orderLine!.find((l) => l.orderId === short.id && l.productId === "croissant")!;
  await reportShortage(baker, croissant.id as string, 14, new Date("2026-11-06T04:00:00Z"), db as unknown as ProductionDb);
  for (const o of [full, short]) await setOrderPrepared(baker, o.id as string, true, new Date("2026-11-06T04:30:00Z"), db as unknown as ProductionDb);
  for (const o of tables.order!) o.status = "DELIVERED";

  const deps = counterDeps(tables, db);
  const first = await generateMerchantInvoice({ companyId: "A", now: MONDAY }, "MD", periodContaining("DAILY", "2026-11-05"), deps);
  const second = await generateMerchantInvoice({ companyId: "A", now: MONDAY }, "MD", periodContaining("DAILY", "2026-11-06"), deps);
  assert.equal(first.status, "CREATED");
  assert.equal(second.status, "CREATED");
  if (first.status !== "CREATED" || second.status !== "CREATED") return;
  // Complète : 40 × 1,10 + 20 × 0,95 = 63,00 HT ; avec manquant : 40 × 1,10 + 14 × 0,95 = 57,30 HT.
  const invoices = tables.invoice!;
  const fullInvoice = invoices.find((i) => i.id === first.invoice.id)!;
  const shortInvoice = invoices.find((i) => i.id === second.invoice.id)!;
  assert.equal(fullInvoice.subtotalCents, 6300);
  assert.equal(shortInvoice.subtotalCents, 5730);
  assert.equal((fullInvoice.subtotalCents as number) - (shortInvoice.subtotalCents as number), 6 * 95, "écart = 6 croissants manquants");
  assert.equal(shortInvoice.totalCents, 5730 + Math.round(5730 * 0.055));
  const croissantLine = tables.invoiceLine!.find((l) => l.invoiceId === shortInvoice.id && l.label === "Croissant")!;
  assert.equal(croissantLine.quantity, 14);
});

// ---------------------------------------------------------------------------
// Génération : idempotence, une commande par facture, numérotation
// ---------------------------------------------------------------------------

test("ADM-10 : idempotent, une commande sur une seule facture, complément pour une livraison tardive", async () => {
  const { tables, add } = fixture();
  add(order("A", "MM", "2026-10-03"), [["baguette", 10, 10, 110]]);
  add(order("A", "MM", "2026-10-20"), [["baguette", 10, 8, 110]]);
  add(order("A", "MM", "2026-11-02"), [["baguette", 10, 10, 110]]); // autre mois
  add(order("A", "MM", "2026-10-21", "PREPARED"), [["baguette", 5, 5, 110]]); // pas livrée
  const db = transactional(tables);
  const deps = counterDeps(tables, db);
  const october = periodContaining("MONTHLY", "2026-10-01");

  const first = await generateMerchantInvoice({ companyId: "A", now: MONDAY }, "MM", october, deps);
  assert.equal(first.status, "CREATED");
  if (first.status !== "CREATED") return;
  assert.equal(first.invoice.reference, "FAC-000001");
  assert.equal(first.invoice.orderCount, 2);
  assert.equal(first.invoice.totalCents, 1980 + Math.round(1980 * 0.055));
  const again = await generateMerchantInvoice({ companyId: "A", now: MONDAY }, "MM", october, deps);
  assert.equal(again.status, "NOTHING_TO_BILL", "relancer ne crée pas de doublon");
  assert.equal(tables.invoice!.length, 1);
  assert.equal(tables.invoiceCounter![0]!.lastNumber, 1, "aucun numéro consommé");
  const billed = tables.order!.filter((o) => o.invoiceId === first.invoice.id).map((o) => o.reference);
  assert.deepEqual(billed.sort(), ["C-1", "C-2"]);
  assert.equal(tables.order!.find((o) => o.reference === "C-4")!.invoiceId, null, "commande non livrée : non facturée");

  // Livraison d'octobre marquée livrée après la facture : facture complémentaire, jamais la facture émise modifiée.
  tables.order!.find((o) => o.reference === "C-4")!.status = "DELIVERED";
  const complement = await generateMerchantInvoice({ companyId: "A", now: MONDAY }, "MM", october, deps);
  assert.equal(complement.status, "CREATED");
  if (complement.status !== "CREATED") return;
  assert.equal(complement.invoice.number, 2);
  assert.equal(complement.invoice.orderCount, 1);
  assert.equal(tables.invoice!.find((i) => i.id === first.invoice.id)!.totalCents, first.invoice.totalCents);
  // Journal et e-mail en file pour chaque facture.
  assert.equal(tables.auditLog!.filter((a) => a.action === "INVOICE_ISSUED").length, 2);
  assert.deepEqual(tables.operationJob!.map((j) => j.jobKey).sort(), [
    `client-notification:invoice-email:${first.invoice.id}:1`,
    `client-notification:invoice-email:${complement.invoice.id}:1`,
  ].sort());
});

test("ENF-05 : numérotation continue sans trou, en concurrence et après une génération annulée", async () => {
  const { tables, add } = fixture();
  for (const date of ["2026-11-02", "2026-11-03", "2026-11-04"]) add(order("A", "MD", date), [["baguette", 10, 10, 110]]);
  add(order("A", "MW", "2026-11-04"), [["baguette", 20, 20, 110]]);
  add(order("A", "MM", "2026-10-15"), [["croissant", 30, 30, 95]]);
  add(order("B", "MB", "2026-10-15"), [["painB", 30, 30, 100]]);
  const db = transactional(tables);
  let sabotage = false;
  const deps = counterDeps(tables, db, () => {
    // Une autre facturation prend la commande pendant la transaction : rattachement refusé, tout est annulé.
    if (sabotage) {
      sabotage = false;
      const target = tables.order!.find((o) => o.reference === "C-1")!;
      target.invoiceId = "autre-facture";
    }
  });
  sabotage = true;
  await assert.rejects(
    generateMerchantInvoice({ companyId: "A", now: MONDAY }, "MD", periodContaining("DAILY", "2026-11-02"), deps),
    (error: Error & { code?: string }) => error.code === "INVOICE_CONFLICT"
  );
  assert.equal(tables.invoice!.length, 0, "facture annulée avec la transaction");
  assert.equal(tables.invoiceCounter!.length, 0, "numéro rendu : pas de trou");
  assert.equal(tables.order!.find((o) => o.reference === "C-1")!.invoiceId, null);

  // Huit générations lancées en même temps, dont des doublons exacts.
  const results = await Promise.all([
    generateMerchantInvoice({ companyId: "A", now: MONDAY }, "MD", periodContaining("DAILY", "2026-11-02"), deps),
    generateMerchantInvoice({ companyId: "A", now: MONDAY }, "MD", periodContaining("DAILY", "2026-11-02"), deps),
    generateMerchantInvoice({ companyId: "A", now: MONDAY }, "MD", periodContaining("DAILY", "2026-11-03"), deps),
    generateMerchantInvoice({ companyId: "A", now: MONDAY }, "MW", periodContaining("WEEKLY", "2026-11-03"), deps),
    generateMerchantInvoice({ companyId: "A", now: MONDAY }, "MW", periodContaining("WEEKLY", "2026-11-03"), deps),
    generateMerchantInvoice({ companyId: "B", now: MONDAY }, "MB", periodContaining("MONTHLY", "2026-10-03"), deps),
    generateMerchantInvoice({ companyId: "A", now: MONDAY }, "MD", periodContaining("DAILY", "2026-11-04"), deps),
    generateMerchantInvoice({ companyId: "A", now: MONDAY }, "MM", periodContaining("MONTHLY", "2026-10-03"), deps),
  ]);
  assert.equal(results.filter((r) => r.status === "CREATED").length, 6);
  const numbers = (companyId: string) => tables.invoice!.filter((i) => i.companyId === companyId).map((i) => i.number as number).sort((a, b) => a - b);
  assert.deepEqual(numbers("A"), [1, 2, 3, 4, 5], "suite continue, sans doublon");
  assert.deepEqual(numbers("B"), [1], "numérotation propre à chaque entreprise");
  assert.equal(new Set(tables.invoice!.map((i) => `${i.companyId}:${i.reference}`)).size, 6);
  // Chaque commande livrée est sur exactement une facture.
  for (const o of tables.order!) assert.ok(o.invoiceId, `${o.reference} facturée`);
});

test("ADM-10 : bouton par période — périodicité respectée, période future refusée", async () => {
  const { tables, add } = fixture();
  add(order("A", "MW", "2026-11-03"), [["baguette", 20, 20, 110]]);
  add(order("A", "MM", "2026-11-03"), [["baguette", 20, 20, 110]]);
  const db = transactional(tables);
  const deps = counterDeps(tables, db);
  const weekly = await generateInvoicesForPeriod({ companyId: "A", now: MONDAY }, { periodType: "WEEKLY", date: "2026-11-05" }, deps);
  assert.equal(weekly.created.length, 1);
  assert.equal(weekly.created[0]!.merchantName, "Bistrot Semaine");
  assert.equal(weekly.period.closed, true);
  assert.equal(weekly.period.label, "Semaine 45 · du 2 novembre au 8 novembre 2026");
  await assert.rejects(
    generateInvoicesForPeriod({ companyId: "A", now: MONDAY }, { periodType: "WEEKLY", date: "2026-11-05", merchantId: "MM" }, deps),
    (error: Error & { code?: string }) => error.code === "PERIODICITY_MISMATCH" && /chaque mois/.test(error.message)
  );
  await assert.rejects(
    generateInvoicesForPeriod({ companyId: "A", now: MONDAY }, { periodType: "DAILY", date: "2026-11-10" }, deps),
    (error: Error & { code?: string }) => error.code === "PERIOD_IN_FUTURE"
  );
  // Isolation : un commerçant d'une autre entreprise est introuvable.
  await assert.rejects(
    generateInvoicesForPeriod({ companyId: "A", now: MONDAY }, { periodType: "MONTHLY", date: "2026-10-05", merchantId: "MB" }, deps),
    (error: Error & { code?: string }) => error.code === "MERCHANT_NOT_FOUND"
  );
});

test("ADM-10 : le cron facture les périodes terminées selon la périodicité de chaque commerçant, retards compris", async () => {
  const { tables, add } = fixture();
  // Lundi 9 novembre : jours passés pour DAILY, semaine 45 pour WEEKLY, octobre pour MONTHLY.
  add(order("A", "MD", "2026-11-05"), [["baguette", 10, 10, 110]]);
  add(order("A", "MD", "2026-11-06"), [["baguette", 10, 10, 110]]);
  add(order("A", "MD", "2026-11-09"), [["baguette", 10, 10, 110]]); // aujourd'hui : pas encore
  add(order("A", "MW", "2026-10-27"), [["baguette", 10, 10, 110]]); // semaine 44, en retard
  add(order("A", "MW", "2026-11-04"), [["baguette", 10, 10, 110]]);
  add(order("A", "MW", "2026-11-08"), [["baguette", 10, 10, 110]]); // dimanche : semaine 45
  add(order("A", "MM", "2026-10-31"), [["croissant", 10, 10, 95]]);
  add(order("A", "MM", "2026-11-02"), [["croissant", 10, 10, 95]]); // mois en cours
  add(order("B", "MB", "2026-10-10"), [["painB", 10, 10, 100]]);
  const db = transactional(tables);
  const deps = counterDeps(tables, db);
  const run = await generateDueInvoices({ now: MONDAY }, deps);
  assert.deepEqual(run, { companies: 2, created: 6, failed: 0, hasMore: false });
  const periods = tables.invoice!.map((i) => `${i.merchantId}:${(i.periodStart as Date).toISOString().slice(0, 10)}`).sort();
  assert.deepEqual(periods, ["MB:2026-10-01", "MD:2026-11-05", "MD:2026-11-06", "MM:2026-10-01", "MW:2026-10-26", "MW:2026-11-02"]);
  const week45 = tables.invoice!.find((i) => i.merchantId === "MW" && (i.periodStart as Date).toISOString().startsWith("2026-11-02"))!;
  assert.equal(tables.order!.filter((o) => o.invoiceId === week45.id).length, 2, "dimanche inclus dans la semaine");
  assert.equal(tables.order!.find((o) => o.reference === "C-3")!.invoiceId, null);
  assert.equal(tables.order!.find((o) => o.reference === "C-8")!.invoiceId, null);
  // Deuxième passage : rien de plus.
  assert.deepEqual(await generateDueInvoices({ now: MONDAY }, deps), { companies: 2, created: 0, failed: 0, hasMore: false });
  // Lot limité : le reste au passage suivant.
  const { tables: t2, add: add2 } = fixture();
  for (const date of ["2026-11-02", "2026-11-03", "2026-11-04"]) add2(order("A", "MD", date), [["baguette", 1, 1, 110]]);
  const db2 = transactional(t2);
  assert.deepEqual(await generateDueInvoices({ now: MONDAY, limit: 2 }, counterDeps(t2, db2)), { companies: 2, created: 2, failed: 0, hasMore: true });
});

// ---------------------------------------------------------------------------
// Règlements (RG-07)
// ---------------------------------------------------------------------------

test("RG-07 : règlement partiel puis total, statut calculé, dépassement refusé, suppression journalisée", async () => {
  const { tables, add } = fixture();
  add(order("A", "MM", "2026-10-03"), [["baguette", 100, 100, 110]]); // 110,00 HT + 6,05 TVA = 116,05
  const db = transactional(tables);
  const created = await generateMerchantInvoice({ companyId: "A", now: MONDAY }, "MM", periodContaining("MONTHLY", "2026-10-03"), counterDeps(tables, db));
  assert.equal(created.status, "CREATED");
  if (created.status !== "CREATED") return;
  const id = created.invoice.id;
  assert.equal(created.invoice.totalCents, 11_605);
  const actor = { companyId: "A", userId: "admin" };
  const payments = db as unknown as PaymentDb;

  assert.equal(settlementStatus(11_605, 0), "TO_PAY");
  const partial = await recordPayment(actor, id, { amountCents: 5000, method: "VIREMENT", paidAt: "2026-11-09", reference: "VIR-123" }, MONDAY, payments);
  assert.equal(partial.settlement, "PARTIAL");
  assert.equal(tables.invoice!.find((i) => i.id === id)!.status, "PENDING");
  await assert.rejects(
    recordPayment(actor, id, { amountCents: 7000, method: "ESPECES", paidAt: "2026-11-09" }, MONDAY, payments),
    (error: Error & { code?: string }) => error.code === "PAYMENT_ABOVE_REMAINING" && /66,05/.test(error.message)
  );
  await assert.rejects(recordPayment(actor, id, { amountCents: 100, method: "ESPECES", paidAt: "2026-11-20" }, MONDAY, payments), /futur/);
  await assert.rejects(recordPayment({ companyId: "B", userId: "x" }, id, { amountCents: 100, method: "ESPECES", paidAt: "2026-11-09" }, MONDAY, payments), /introuvable/);
  const full = await recordPayment(actor, id, { amountCents: 6605, method: "PRELEVEMENT", paidAt: "2026-11-09" }, MONDAY, payments);
  assert.equal(full.settlement, "PAID");
  const paid = tables.invoice!.find((i) => i.id === id)!;
  assert.equal(paid.status, "PAID");
  assert.equal(paid.paymentMethod, "PRELEVEMENT");
  await assert.rejects(recordPayment(actor, id, { amountCents: 1, method: "ESPECES", paidAt: "2026-11-09" }, MONDAY, payments), /déjà réglée/);
  assert.equal(tables.payment!.find((p) => p.amountCents === 5000)!.note, "VIR-123", "référence conservée");

  const removed = await deletePayment(actor, id, tables.payment!.find((p) => p.amountCents === 6605)!.id as string, payments);
  assert.equal(removed.settlement, "PARTIAL");
  assert.equal(tables.invoice!.find((i) => i.id === id)!.status, "PENDING");
  assert.equal(tables.invoice!.find((i) => i.id === id)!.paidAt, null);
  assert.deepEqual(tables.auditLog!.filter((a) => a.entityId === id).map((a) => a.action), ["INVOICE_ISSUED", "PAYMENT_RECORDED", "PAYMENT_RECORDED", "PAYMENT_DELETED"]);

  // Fiche : reste dû, règlements, saisi par.
  const detail = await getAdminInvoice("A", id, { now: MONDAY }, db as unknown as InvoiceQueryDb);
  assert.equal(detail.paidCents, 5000);
  assert.equal(detail.remainingCents, 6605);
  assert.equal(detail.settlement, "PARTIAL");
  assert.equal(detail.payments[0]!.recordedBy, "Alice Admin");
  assert.equal(detail.canRemind, true);
});

// ---------------------------------------------------------------------------
// Lectures : isolation, portail, e-mail, export
// ---------------------------------------------------------------------------

test("PLA-01, CLI-10 : un commerçant ne voit que ses factures, une entreprise que les siennes ; filtres par période", async () => {
  const { tables, add } = fixture();
  add(order("A", "MD", "2026-11-03"), [["baguette", 10, 10, 110]]);
  add(order("A", "MD", "2026-11-04"), [["baguette", 10, 10, 110]]);
  add(order("A", "MW", "2026-11-04"), [["baguette", 10, 10, 110]]);
  add(order("B", "MB", "2026-10-04"), [["painB", 10, 10, 100]]);
  const db = transactional(tables);
  await generateDueInvoices({ now: MONDAY }, counterDeps(tables, db));
  const query = db as unknown as InvoiceQueryDb;

  const mine = await listMerchantInvoices({ companyId: "A", merchantId: "MD" }, { periodType: "MONTHLY", date: "2026-11-15" }, MONDAY, query);
  assert.equal(mine.invoices.length, 2);
  assert.ok(mine.invoices.every((i) => i.merchant.id === "MD"));
  assert.equal(mine.period.label, "Novembre 2026");
  assert.equal(mine.totals.totalCents, 2 * (1100 + 61));
  const oneDay = await listMerchantInvoices({ companyId: "A", merchantId: "MD" }, { periodType: "DAILY", date: "2026-11-04" }, MONDAY, query);
  assert.equal(oneDay.invoices.length, 1);
  const october = await listMerchantInvoices({ companyId: "A", merchantId: "MD" }, { periodType: "MONTHLY", date: "2026-10-15" }, MONDAY, query);
  assert.equal(october.invoices.length, 0);
  // Commerçant d'une autre entreprise demandé avec l'entreprise A : introuvable.
  await assert.rejects(listMerchantInvoices({ companyId: "A", merchantId: "MB" }, { periodType: "MONTHLY", date: "2026-10-15" }, MONDAY, query), /introuvable/);

  const listA = await listAdminInvoices("A", {}, MONDAY, query);
  assert.equal(listA.invoices.length, 3);
  assert.ok(listA.merchants.every((m) => m.id !== "MB"));
  assert.equal((await listAdminInvoices("A", { merchantId: "MW" }, MONDAY, query)).invoices.length, 1);
  assert.equal((await listAdminInvoices("A", { from: "2026-11-04", to: "2026-11-04" }, MONDAY, query)).invoices.length, 2, "MD du 4 + semaine 45 de MW");
  assert.equal((await listAdminInvoices("A", { status: "PAID" }, MONDAY, query)).invoices.length, 0);
  assert.equal((await listAdminInvoices("B", {}, MONDAY, query)).invoices.length, 1);
  const invoiceB = tables.invoice!.find((i) => i.companyId === "B")!;
  await assert.rejects(getAdminInvoice("A", invoiceB.id as string, { now: MONDAY }, query), /introuvable/);
  // Retard calculé à la lecture (Paris) : échéance à 30 jours.
  const late = await listAdminInvoices("A", { status: "OVERDUE" }, new Date("2026-12-20T10:00:00Z"), query);
  assert.equal(late.invoices.length, 3);
  assert.ok(late.invoices.every((i) => i.daysOverdue > 0));
});

test("ADM-10 : envoi par e-mail — sans service configuré, échec propre affiché et relançable", () => {
  const base = { jobKey: "client-notification:invoice-email:inv1:2", updatedAt: new Date("2026-11-09T06:00:00Z") };
  assert.deepEqual(emailStatusFromJob({ ...base, status: "SUCCEEDED", lastError: "SKIPPED:INVOICE_EMAIL_DISABLED:disabled", payload: {} }), { state: "NOT_CONFIGURED", attempt: 2, at: "2026-11-09T06:00:00.000Z", recipient: null });
  assert.equal(emailStatusFromJob({ ...base, status: "SUCCEEDED", lastError: "SKIPPED:INVOICE_EMAIL_NO_RECIPIENT", payload: {} })!.state, "NO_RECIPIENT");
  assert.deepEqual(emailStatusFromJob({ ...base, status: "SUCCEEDED", lastError: null, payload: { emailSnapshot: { to: "jour@test.fr" } } }), { state: "SENT", attempt: 2, at: "2026-11-09T06:00:00.000Z", recipient: "jour@test.fr" });
  assert.equal(emailStatusFromJob({ ...base, status: "FAILED", lastError: "EMAIL_PROVIDER_HTTP_500", payload: {} })!.state, "FAILED");
  assert.equal(emailStatusFromJob({ ...base, status: "PENDING", lastError: null, payload: {} })!.state, "PENDING");
  const text = invoiceEmailText({ reference: "FAC-000001", companyName: "Boulangerie", periodSentence: "du 1 novembre 2026 au 30 novembre 2026", totalCents: 11_605, dueDate: new Date("2026-12-09T11:00:00Z"), link: "https://annona.fr/portal/invoices" });
  assert.match(text, /FAC-000001/);
  assert.match(text, /116,05/);
  assert.match(text, /9 décembre 2026/);
  // Route d'envoi : ADMIN seulement, entreprise de la session.
  const job = readFileSync("src/domains/operations/operation-job.service.ts", "utf8");
  assert.match(job, /"INVOICE_EMAIL"[\s\S]*deliverInvoiceEmailJob/);
  const service = readFileSync("src/domains/invoice/invoice-email.service.ts", "utf8");
  assert.match(service, /skippedJobError\(`INVOICE_EMAIL_DISABLED/);
});

test("ADM-10 : export comptable CSV sûr (séparateur, guillemets, formule neutralisée)", () => {
  assert.equal(csvField("Café ; Lumière"), '"Café ; Lumière"');
  assert.equal(csvField('Le "Comptoir"'), '"Le ""Comptoir"""');
  assert.equal(csvField("=HYPERLINK(1)"), "'=HYPERLINK(1)");
  assert.equal(csvField("FAC-000001"), "FAC-000001");
});

// ---------------------------------------------------------------------------
// Corrections après facturation, droits
// ---------------------------------------------------------------------------

test("FACT-1 : une commande facturée ne se corrige plus (refus explicite, avoir)", async () => {
  const { tables } = fixture();
  tables.order!.push({ ...order("A", "MD", "2026-11-03"), invoiceId: "inv1" });
  tables.invoice!.push({ id: "inv1", companyId: "A", reference: "FAC-000007" });
  const db = createMemoryDb(tables) as unknown as AdminOrderDb;
  await assert.rejects(
    correctAdminOrder({ companyId: "A", userId: "admin" }, tables.order![0]!.id as string, { lines: [{ productId: "baguette", quantity: 3 }] }, MONDAY, db),
    (error: Error & { code?: string; status?: number }) => error.code === "ORDER_INVOICED" && error.status === 409 && /FAC-000007/.test(error.message) && /avoir/.test(error.message)
  );
});

function routeFiles(dir: string): string[] {
  // Séparateur « / » sous Windows aussi : le filtre « /pdf/ » en dépend.
  return readdirSync(dir, { recursive: true })
    .map((entry) => join(dir, entry.toString()).split("\\").join("/"))
    .filter((file) => file.endsWith("route.ts"));
}

test("Droits : factures réservées à l'ADMIN (back-office) et au MERCHANT propriétaire (portail) ; BAKER et DRIVER refusés", () => {
  const admin = routeFiles("src/app/api/invoices").filter((file) => !file.includes("/pdf/"));
  assert.ok(admin.length >= 7, admin.join(","));
  for (const file of admin) {
    const source = readFileSync(file, "utf8");
    const handlers = source.split(/export async function (?:GET|POST|PUT|PATCH|DELETE)/).slice(1);
    assert.ok(handlers.length > 0, file);
    for (const body of handlers) assert.match(body, /requireCompanyAdmin\("invoices:(read|create|update)"\)/, file);
    assert.doesNotMatch(source, /companyId: (?:body|input|params)/, file);
  }
  assert.match(readFileSync("src/app/api/invoices/[id]/pdf/route.ts", "utf8"), /requireRole\(auth\.context, \["ADMIN"\]\)/);
  for (const file of routeFiles("src/app/api/portal/invoices")) {
    assert.match(readFileSync(file, "utf8"), /requireMerchant(Actor|Role)\(\)/, file);
  }
  for (const role of ["BAKER", "DRIVER"] as const) {
    assert.ok(ROLE_PERMISSIONS[role].every((permission) => !permission.startsWith("invoices:")), role);
  }
  assert.ok(!ROLE_PERMISSIONS.MERCHANT.includes("invoices:update") && !ROLE_PERMISSIONS.MERCHANT.includes("invoices:create"));
  assert.deepEqual([...(getPageAccessRule("/dashboard/invoices/abc")?.roles ?? [])], ["ADMIN"]);
  assert.deepEqual([...(getPageAccessRule("/portal/invoices")?.roles ?? [])], ["MERCHANT"]);
  // Cron : même secret que les autres crons.
  assert.match(readFileSync("src/app/api/cron/billing/route.ts", "utf8"), /authorization"\) !== `Bearer \$\{secret\}`/);
});

// ---------------------------------------------------------------------------
// Mentions légales (ENF-05), PDF et Factur-X
// ---------------------------------------------------------------------------

const SELLER = {
  name: "Boulangerie Démo",
  legalName: "Boulangerie Démo SAS",
  siren: "732829320",
  siret: "73282932000074",
  email: "contact@boulangerie.test",
  billingAddress: "8 rue de la Roquette",
  billingPostalCode: "75011",
  billingCity: "Paris",
  country: "FR",
};
const NONE: EinvoicingSettings = {
  vatNumber: undefined,
  taxRegistrationId: undefined,
  legalForm: undefined,
  shareCapital: undefined,
  rcs: undefined,
  iban: undefined,
  bic: undefined,
  paymentTermsText: undefined,
  latePenaltyText: undefined,
  earlyPaymentDiscountText: undefined,
  vatExemptionReason: undefined,
};
const EINVOICING: EinvoicingSettings = {
  ...NONE,
  vatNumber: "FR44732829320",
  legalForm: "SAS",
  shareCapital: "10 000 €",
  rcs: "RCS Paris 732 829 320",
  latePenaltyText: "Pénalités de retard : trois fois le taux d'intérêt légal.",
  earlyPaymentDiscountText: "Pas d'escompte pour paiement anticipé.",
};

test("ENF-05 : mentions absentes signalées à l'admin, jamais inventées ; indemnité de 40 € toujours portée", () => {
  const incomplete = invoiceLegalGaps({ ...SELLER, siren: null }, NONE, { hasVat: true, hasExempt: false });
  assert.deepEqual(incomplete.map((gap) => gap.field), ["siren", "vatNumber", "legalForm", "rcs", "latePenaltyText", "earlyPaymentDiscountText"]);
  assert.ok(incomplete.every((gap) => gap.href.startsWith("/settings/billing#einvoicing-")));
  assert.deepEqual(invoiceLegalGaps(SELLER, EINVOICING, { hasVat: true, hasExempt: false }), []);
  assert.deepEqual(invoiceLegalGaps(SELLER, EINVOICING, { hasVat: false, hasExempt: true }).map((g) => g.field), ["vatExemptionReason"]);

  const buyer = { name: "Café Jour", siren: null, vatNumber: null, address: "1 rue", postalCode: "75011", city: "Paris" };
  const bare = invoiceLegalMentions({ seller: { ...SELLER, siren: null }, einvoicing: NONE, buyer, dueDate: new Date("2026-12-09T11:00:00Z"), periodSentence: "du 1 novembre 2026 au 30 novembre 2026", hasExempt: false });
  assert.equal(bare.documentLabel, "Facture");
  assert.ok(bare.mentions.some((m) => /40 €/.test(m)));
  assert.ok(bare.mentions.some((m) => /09\/12\/2026/.test(m)), "échéance calculée");
  assert.ok(!bare.mentions.some((m) => /pénalit/i.test(m)), "pénalités non inventées");
  assert.ok(!bare.seller.lines.some((l) => /SIREN/.test(l)));
  const full = invoiceLegalMentions({ seller: SELLER, einvoicing: EINVOICING, buyer: { ...buyer, siren: "552100554" }, dueDate: null, periodSentence: "le 5 novembre 2026", hasExempt: false });
  assert.ok(full.seller.lines.includes("SIREN 732829320") && full.seller.lines.includes("TVA FR44732829320"));
  assert.ok(full.mentions.includes(EINVOICING.latePenaltyText!) && full.mentions.includes("SAS au capital de 10 000 € — RCS Paris 732 829 320"));
  assert.ok(full.buyer.lines.includes("SIREN 552100554"));
});

test("ENF-05, RG-06 : PDF de facture — mentions, HT, TVA par taux, TTC, déjà réglé, livraisons incluses", async () => {
  const legal = invoiceLegalMentions({
    seller: SELLER,
    einvoicing: EINVOICING,
    buyer: { name: "Café Jour", siren: null, vatNumber: null, address: "1 rue", postalCode: "75011", city: "Paris" },
    dueDate: new Date("2026-12-09T11:00:00Z"),
    periodSentence: "du 1 novembre 2026 au 30 novembre 2026",
    hasExempt: false,
  });
  const pdf = await generateInvoicePdf({
    reference: "FAC-000001",
    status: "PENDING",
    statusLabel: "Partiellement réglée",
    createdAt: new Date("2026-12-01T06:00:00Z"),
    dueDate: new Date("2026-12-31T11:00:00Z"),
    amount: 114.02,
    period: "Novembre 2026",
    lineItems: [
      { label: "Baguette", amount: 1.1, quantity: 85, detail: "pièce · TVA 5,5 %" },
      { label: "Sandwich", amount: 4.5, quantity: 3, detail: "pièce · TVA 10 %" },
    ],
    totals: { subtotal: 107.5, vat: [{ label: "TVA 5,5 % sur 93,50 €", amount: 5.14 }, { label: "TVA 10 % sur 13,50 €", amount: 1.35 }], total: 113.99, paid: 50 },
    orders: [{ reference: "C-1", date: "03/11/2026", amount: 57.5 }, { reference: "C-2", date: "04/11/2026", amount: 50, shortage: true }],
    company: { name: "Boulangerie Démo SAS" },
    customerName: "Café Jour",
    legal,
  });
  const text = (await pdfText(pdf)).replace(/\s+/g, " ");
  for (const expected of ["Facture", "FAC-000001", "Novembre 2026", "Partiellement réglée", "Total HT", "TVA 5,5 % sur 93,50", "Total TTC", "Déjà réglé", "Reste à régler", "LIVRAISONS INCLUSES", "manquant signalé", "SIREN 732829320", "40 €", "trois fois le taux"]) {
    assert.ok(text.includes(expected), `PDF : « ${expected} » absent`);
  }
  const statement = await generateStatementPdf({
    companyName: "Boulangerie Démo SAS",
    merchantName: "Café Jour",
    periodLabel: "Novembre 2026",
    issuedAt: MONDAY,
    invoices: [{ reference: "FAC-000001", period: "05/11/2026", issuedAt: "2026-11-06T06:00:00Z", dueDate: "2026-12-06T11:00:00Z", total: 11.61, paid: 0, remaining: 11.61, status: "À régler" }],
    totals: { total: 11.61, paid: 0, remaining: 11.61 },
  });
  const statementText = (await pdfText(statement)).replace(/\s+/g, " ");
  for (const expected of ["RELEVÉ DE FACTURES", "Novembre 2026", "FAC-000001", "Reste à régler", "Café Jour"]) assert.ok(statementText.includes(expected), `relevé : « ${expected} »`);
});

test("ENF-05 : Factur-X d'une facture de période (plusieurs taux, règlement partiel) toujours valide", async () => {
  const built = buildInvoice([
    { id: "o1", reference: "C-1", deliveryDate: "2026-11-03", lines: [
      { productId: "baguette", name: "Baguette", unit: "pièce", quantityOrdered: 40, quantityDelivered: 34, unitPriceFrozenCents: 110, vatRateBasisPoints: 550 },
      { productId: "sandwich", name: "Sandwich", unit: "pièce", quantityOrdered: 3, quantityDelivered: 3, unitPriceFrozenCents: 450, vatRateBasisPoints: 1000 },
    ] },
  ]);
  const source: FacturXSource = {
    invoice: {
      reference: "FAC-000001",
      status: "PENDING",
      createdAt: new Date("2026-11-04T06:00:00Z"),
      dueDate: new Date("2026-12-04T11:00:00Z"),
      lines: built.lines.map(({ label, quantity, unitPriceCents, vatRateBasisPoints }) => ({ label, quantity, unitPriceCents, vatRateBasisPoints })),
      subtotalCents: built.subtotalCents,
      vatCents: built.vatCents,
      totalCents: built.totalCents,
      paidCents: 2000,
      notes: null,
      orderReference: null,
      deliveryDate: new Date("2026-11-03T00:00:00Z"),
    },
    seller: SELLER,
    einvoicing: { ...EINVOICING, iban: "FR7630006000011234567890189", bic: "AGRIFRPP" },
    buyer: { firstName: "Café Jour", lastName: "", email: "jour@test.fr", identity: { companyName: "Café Jour", siren: "552100554", vatNumber: undefined, address: "1 rue", postalCode: "75011", city: "Paris", countryCode: "FR" }, defaultAddress: null },
  };
  const mapped = mapInvoiceToFacturX(source);
  assert.ok(mapped.ok, JSON.stringify(mapped.ok ? [] : mapped.errors));
  if (!mapped.ok) return;
  assert.equal(mapped.totals.taxTotalCents, built.vatCents, "TVA par taux identique à la facture");
  assert.equal(mapped.totals.grandTotalCents, built.totalCents);
  assert.equal(mapped.totals.prepaidCents, 2000);
  assert.equal(mapped.totals.duePayableCents, built.totalCents - 2000);
  assert.match(facturXVisibleMentions(mapped.invoice).mentions.join(" "), /solde dû : 34,31/);
  const pdf = await buildFacturXPdf({ source, renderClassicPdf: async (legal) => generateInvoicePdf({ reference: "FAC-000001", status: "PENDING", createdAt: new Date(), amount: built.totalCents / 100, lineItems: [], company: { name: "B" }, legal }), now: MONDAY });
  assert.ok(pdf.ok);
  if (pdf.ok) {
    assert.match(pdf.xml, /<ram:DuePayableAmount>34.31<\/ram:DuePayableAmount>/);
    assert.match(pdf.xml, /<ram:RateApplicablePercent>5.50<\/ram:RateApplicablePercent>/);
    assert.match(pdf.xml, /<ram:RateApplicablePercent>10.00<\/ram:RateApplicablePercent>/);
  }
  // Démo sans SIREN ni mention de pénalités : export refusé avec la liste des champs, PDF toujours possible.
  const refused = mapInvoiceToFacturX({ ...source, seller: { ...SELLER, siren: null }, einvoicing: NONE });
  assert.equal(refused.ok, false);
});
