/**
 * FACT-1 — génération des factures de période (ADM-10, RG-06, ENF-05, critère 9).
 *
 * Une facture regroupe, pour un commerçant et une période (jour, semaine ISO, mois, année, selon sa
 * périodicité), toutes ses commandes LIVRÉES de la période pas encore facturées. Montants sur
 * `quantité livrée × prix unitaire figé` (RG-06, RG-05), TVA par taux, totaux en centimes.
 *
 * Garanties :
 * - Numérotation continue sans trou par entreprise : le numéro est pris dans la transaction qui crée
 *   la facture (`nextInvoiceNumber`, verrou de la ligne `invoice_counters`) ; un échec annule les deux.
 * - Idempotence et sérialisation : la transaction verrouille la ligne du commerçant (`FOR UPDATE`) avant
 *   de relire ses commandes non facturées. Deux générations simultanées pour le même commerçant
 *   s'exécutent l'une après l'autre ; la seconde ne trouve plus rien et ne consomme aucun numéro.
 * - Une commande sur une seule facture : `orders.invoice_id` est rattaché par une mise à jour conditionnée
 *   sur `invoice_id IS NULL` ; si une commande a été prise entre-temps, tout est annulé (409).
 * - Une commande facturée ne se corrige plus (admin-order.service.ts refuse, message explicite) : la
 *   rectification passe par un avoir, établi hors application à ce stade.
 * - Une livraison tardive d'une période déjà facturée donne une facture complémentaire pour la même
 *   période (jamais une modification de la facture émise).
 */
import type { BillingPeriod, Prisma } from "@prisma/client";
import {
  currentPeriod,
  dbDateKey,
  isPeriodClosed,
  isPeriodInFuture,
  periodContaining,
  periodDateToDb,
  periodLabel,
  todayKey,
  type BillingPeriodRange,
} from "@/domains/invoice/billing-period";
import { buildInvoice, type BillableOrder, type BuiltInvoice } from "@/domains/invoice/invoice-builder";
import { formatInvoiceReference, nextInvoiceNumber } from "@/domains/invoice/invoice-number";
import { INVOICE_AUDIT_ENTITY, invoiceEmailJobKey, INVOICE_EMAIL_KIND } from "@/domains/invoice/invoice-email-keys";
import { parseBillingSettings } from "@/domains/company/billing-settings.service";
import { enqueueOperationJob, kickOperationJob } from "@/domains/operations/operation-job.service";
import { DomainRuleError } from "@/lib/errors/domain-rule-error";
import { fr } from "@/lib/i18n/fr";
import { addCalendarDays, parseCalendarDate, zonedWallTimeToUtc } from "@/lib/time/paris";
import { prisma } from "@/services/prisma/client";

const t = fr.invoices.errors;


type Tx = Pick<
  Prisma.TransactionClient,
  "merchant" | "order" | "orderLine" | "product" | "invoice" | "invoiceLine" | "auditLog" | "operationJob" | "$queryRaw"
>;

export type InvoiceGenerationDb = Pick<Prisma.TransactionClient, "company" | "merchant" | "order"> & {
  $transaction: <T>(fn: (tx: Tx) => Promise<T>, options?: { maxWait?: number; timeout?: number }) => Promise<T>;
};

export interface InvoiceGenerationDeps {
  db?: InvoiceGenerationDb;
  /** Numéro suivant de l'entreprise, dans la transaction (par défaut : `invoice_counters`). */
  nextNumber?: (tx: Tx, companyId: string) => Promise<number>;
  /** Lancement immédiat de l'envoi après validation (par défaut : tâche durable reprise par le cron). */
  kick?: (jobId: string) => void;
}

export interface GenerationContext {
  companyId: string;
  /** Administrateur qui a lancé la génération ; vide pour le cron. */
  actorId?: string | null;
  now?: Date;
  /** Envoi par e-mail de chaque facture créée (ADM-10). Oui par défaut. */
  sendEmail?: boolean;
}

export interface CreatedInvoiceSummary {
  id: string;
  number: number;
  reference: string;
  merchantId: string;
  merchantName: string;
  periodStart: string;
  periodEnd: string;
  totalCents: number;
  orderCount: number;
}

export type MerchantGenerationResult =
  | { status: "CREATED"; invoice: CreatedInvoiceSummary; skipped: BuiltInvoice["skipped"] }
  | { status: "NOTHING_TO_BILL"; skipped: BuiltInvoice["skipped"] };

interface CompanyBillingContext {
  timezone: string;
  referencePrefix: string;
  defaultDueDays: number;
}

async function loadCompanyContext(db: Pick<InvoiceGenerationDb, "company">, companyId: string): Promise<CompanyBillingContext> {
  const company = await db.company.findUnique({ where: { id: companyId }, select: { timezone: true, settings: true } });
  if (!company) throw new DomainRuleError(404, t.companyNotFound, "COMPANY_NOT_FOUND");
  const settings = (company.settings ?? {}) as Record<string, unknown>;
  const billing = parseBillingSettings(settings.billing).invoice;
  return {
    timezone: company.timezone || "Europe/Paris",
    referencePrefix: billing.referencePrefix?.trim() || "FAC",
    defaultDueDays: billing.defaultDueDays || 30,
  };
}

/** Échéance : jour d'émission (fuseau de l'entreprise) + délai des réglages, à midi. */
export function invoiceDueDate(now: Date, timeZone: string, dueDays: number): Date {
  const today = parseCalendarDate(todayKey(now, timeZone))!;
  return zonedWallTimeToUtc(addCalendarDays(today, dueDays), { hour: 12, minute: 0 }, timeZone);
}

async function loadBillableOrders(tx: Tx, companyId: string, merchantId: string, period: BillingPeriodRange): Promise<BillableOrder[]> {
  const orders = await tx.order.findMany({
    where: {
      companyId,
      merchantId,
      status: "DELIVERED",
      invoiceId: null,
      deliveryDate: { gte: periodDateToDb(period.start), lte: periodDateToDb(period.end) },
    },
    select: { id: true, reference: true, deliveryDate: true },
  });
  if (orders.length === 0) return [];
  const lines = await tx.orderLine.findMany({
    where: { companyId, orderId: { in: orders.map((order) => order.id) } },
    select: { orderId: true, productId: true, quantityOrdered: true, quantityDelivered: true, unitPriceFrozenCents: true },
  });
  const products = await tx.product.findMany({
    where: { companyId, id: { in: [...new Set(lines.map((line) => line.productId))] } },
    select: { id: true, name: true, unit: true, vatRateBasisPoints: true },
  });
  const productById = new Map(products.map((product) => [product.id, product]));
  return orders.map((order) => ({
    id: order.id,
    reference: order.reference,
    deliveryDate: dbDateKey(order.deliveryDate),
    lines: lines
      .filter((line) => line.orderId === order.id)
      .map((line) => {
        const product = productById.get(line.productId);
        return {
          productId: line.productId,
          name: product?.name ?? "",
          unit: product?.unit ?? null,
          quantityOrdered: line.quantityOrdered,
          quantityDelivered: line.quantityDelivered,
          unitPriceFrozenCents: line.unitPriceFrozenCents,
          vatRateBasisPoints: product?.vatRateBasisPoints ?? 0,
        };
      }),
  }));
}

/**
 * Facture d'un commerçant pour une période. Sans commande livrée à facturer, ne crée rien et ne
 * consomme aucun numéro (idempotent : relancer ne fait pas de doublon).
 */
export async function generateMerchantInvoice(
  context: GenerationContext,
  merchantId: string,
  period: BillingPeriodRange,
  deps: InvoiceGenerationDeps = {}
): Promise<MerchantGenerationResult> {
  const db = deps.db ?? (prisma as unknown as InvoiceGenerationDb);
  const now = context.now ?? new Date();
  const company = await loadCompanyContext(db, context.companyId);
  const nextNumber = deps.nextNumber ?? ((tx: Tx, companyId: string) => nextInvoiceNumber(tx, companyId));

  const outcome = await db.$transaction(async (tx) => {
    // Verrou du commerçant : deux générations simultanées pour lui sont sérialisées.
    await tx.$queryRaw`SELECT id FROM "merchants" WHERE id = ${merchantId} AND company_id = ${context.companyId} FOR UPDATE`;
    const merchant = await tx.merchant.findFirst({ where: { id: merchantId, companyId: context.companyId }, select: { id: true, name: true, tradeName: true } });
    if (!merchant) throw new DomainRuleError(404, t.merchantNotFound, "MERCHANT_NOT_FOUND");

    const built = buildInvoice(await loadBillableOrders(tx, context.companyId, merchantId, period));
    if (built.lines.length === 0 || built.totalCents <= 0) {
      return { result: { status: "NOTHING_TO_BILL", skipped: built.skipped } as MerchantGenerationResult, jobId: null };
    }

    const number = await nextNumber(tx, context.companyId);
    const reference = formatInvoiceReference(company.referencePrefix, number);
    const invoice = await tx.invoice.create({
      data: {
        companyId: context.companyId,
        merchantId,
        number,
        reference,
        periodType: period.type,
        periodStart: periodDateToDb(period.start),
        periodEnd: periodDateToDb(period.end),
        issuedAt: now,
        dueDate: invoiceDueDate(now, company.timezone, company.defaultDueDays),
        subtotalCents: built.subtotalCents,
        vatCents: built.vatCents,
        totalCents: built.totalCents,
        status: "PENDING",
      },
      select: { id: true },
    });
    await tx.invoiceLine.createMany({
      data: built.lines.map((line) => ({
        companyId: context.companyId,
        invoiceId: invoice.id,
        productId: line.productId,
        label: line.label,
        unit: line.unit,
        quantity: line.quantity,
        unitPriceCents: line.unitPriceCents,
        vatRateBasisPoints: line.vatRateBasisPoints,
        totalCents: line.totalCents,
        sortOrder: line.sortOrder,
      })),
    });
    // Une commande sur une seule facture : rattachement conditionné, tout ou rien.
    const orderIds = built.orders.map((order) => order.id);
    const claimed = await tx.order.updateMany({
      where: { companyId: context.companyId, id: { in: orderIds }, status: "DELIVERED", invoiceId: null },
      data: { invoiceId: invoice.id },
    });
    if (claimed.count !== orderIds.length) throw new DomainRuleError(409, t.conflict, "INVOICE_CONFLICT");

    await tx.auditLog.create({
      data: {
        companyId: context.companyId,
        actorId: context.actorId ?? null,
        entityType: INVOICE_AUDIT_ENTITY,
        entityId: invoice.id,
        action: "INVOICE_ISSUED",
        after: { reference, periodType: period.type, periodStart: period.start, periodEnd: period.end, totalCents: built.totalCents, orders: orderIds.length },
      },
    });

    let jobId: string | null = null;
    if (context.sendEmail !== false) {
      const job = await enqueueOperationJob(tx, {
        jobKey: invoiceEmailJobKey(invoice.id, 1),
        type: "CLIENT_NOTIFICATION",
        companyId: context.companyId,
        payload: { kind: INVOICE_EMAIL_KIND, invoiceId: invoice.id, companyId: context.companyId },
      });
      jobId = job.id;
    }

    const summary: CreatedInvoiceSummary = {
      id: invoice.id,
      number,
      reference,
      merchantId,
      merchantName: merchant.tradeName || merchant.name,
      periodStart: period.start,
      periodEnd: period.end,
      totalCents: built.totalCents,
      orderCount: orderIds.length,
    };
    return { result: { status: "CREATED", invoice: summary, skipped: built.skipped } as MerchantGenerationResult, jobId };
  }, { maxWait: 10_000, timeout: 30_000 });

  if (outcome.jobId) (deps.kick ?? kickOperationJob)(outcome.jobId);
  return outcome.result;
}

export interface PeriodGenerationResult {
  period: BillingPeriodRange & { label: string; closed: boolean };
  created: CreatedInvoiceSummary[];
  /** Commerçants de cette périodicité sans livraison à facturer sur la période. */
  nothingToBill: number;
  skipped: Array<{ merchantName: string; reference: string; reason: string }>;
}

/**
 * Bouton « Générer les factures » (ADM-10) : la période choisie (type + un jour qu'elle contient),
 * pour les commerçants facturés à cette périodicité, ou pour un seul.
 */
export async function generateInvoicesForPeriod(
  context: GenerationContext,
  input: { periodType: BillingPeriod; date: string; merchantId?: string | null },
  deps: InvoiceGenerationDeps = {}
): Promise<PeriodGenerationResult> {
  const db = deps.db ?? (prisma as unknown as InvoiceGenerationDb);
  const now = context.now ?? new Date();
  const { timezone } = await loadCompanyContext(db, context.companyId);
  const period = periodContaining(input.periodType, input.date);
  if (isPeriodInFuture(period, now, timezone)) throw new DomainRuleError(400, t.futurePeriod, "PERIOD_IN_FUTURE");

  if (input.merchantId) {
    const merchant = await db.merchant.findFirst({ where: { id: input.merchantId, companyId: context.companyId }, select: { billingPeriod: true } });
    if (!merchant) throw new DomainRuleError(404, t.merchantNotFound, "MERCHANT_NOT_FOUND");
    if (merchant.billingPeriod !== input.periodType) {
      throw new DomainRuleError(400, t.periodicityMismatch(fr.invoices.periodicity[merchant.billingPeriod] ?? ""), "PERIODICITY_MISMATCH");
    }
  }
  const merchants = await db.merchant.findMany({
    where: { companyId: context.companyId, billingPeriod: input.periodType, ...(input.merchantId ? { id: input.merchantId } : {}) },
    select: { id: true, name: true, tradeName: true },
  });
  const result: PeriodGenerationResult = {
    period: { ...period, label: periodLabel(period), closed: isPeriodClosed(period, now, timezone) },
    created: [],
    nothingToBill: 0,
    skipped: [],
  };
  for (const merchant of [...merchants].sort((a, b) => (a.tradeName || a.name).localeCompare(b.tradeName || b.name, "fr"))) {
    const outcome = await generateMerchantInvoice({ ...context, now }, merchant.id, period, deps);
    if (outcome.status === "CREATED") result.created.push(outcome.invoice);
    else result.nothingToBill += 1;
    for (const skipped of outcome.skipped) result.skipped.push({ merchantName: merchant.tradeName || merchant.name, reference: skipped.reference, reason: skipped.reason });
  }
  return result;
}

export interface DueGenerationResult {
  companies: number;
  created: number;
  failed: number;
  /** Il reste des périodes à facturer (limite du lot atteinte) : un nouvel appel les traitera. */
  hasMore: boolean;
}

/**
 * Cron quotidien (ADM-10) : facture toutes les périodes TERMINÉES selon la périodicité de chaque
 * commerçant (la journée d'hier pour DAILY, la semaine passée le lundi pour WEEKLY, le mois passé le
 * 1er pour MONTHLY…), y compris un retard de plusieurs périodes. Idempotent.
 */
export async function generateDueInvoices(
  options: { now?: Date; limit?: number } = {},
  deps: InvoiceGenerationDeps = {}
): Promise<DueGenerationResult> {
  const db = deps.db ?? (prisma as unknown as InvoiceGenerationDb);
  const now = options.now ?? new Date();
  const limit = options.limit ?? 100;
  const companies = await db.company.findMany({ where: { status: { in: ["ACTIVE", "TRIAL"] } }, select: { id: true, timezone: true } });
  const result: DueGenerationResult = { companies: companies.length, created: 0, failed: 0, hasMore: false };

  for (const company of companies) {
    const timezone = company.timezone || "Europe/Paris";
    const pending = await db.order.findMany({
      where: { companyId: company.id, status: "DELIVERED", invoiceId: null, deliveryDate: { lt: periodDateToDb(todayKey(now, timezone)) } },
      select: { merchantId: true, deliveryDate: true },
    });
    if (pending.length === 0) continue;
    const merchants = await db.merchant.findMany({
      where: { companyId: company.id, id: { in: [...new Set(pending.map((order) => order.merchantId))] } },
      select: { id: true, billingPeriod: true },
    });
    const work: Array<{ merchantId: string; period: BillingPeriodRange }> = [];
    for (const merchant of merchants) {
      const current = currentPeriod(merchant.billingPeriod, now, timezone);
      const periods = new Map<string, BillingPeriodRange>();
      for (const order of pending) {
        if (order.merchantId !== merchant.id) continue;
        const day = dbDateKey(order.deliveryDate);
        if (day >= current.start) continue; // Période en cours : facturée quand elle sera terminée.
        const period = periodContaining(merchant.billingPeriod, day);
        periods.set(period.start, period);
      }
      for (const period of [...periods.values()].sort((a, b) => a.start.localeCompare(b.start))) work.push({ merchantId: merchant.id, period });
    }
    for (const item of work) {
      if (result.created >= limit) {
        result.hasMore = true;
        break;
      }
      try {
        const outcome = await generateMerchantInvoice({ companyId: company.id, now, actorId: null, sendEmail: true }, item.merchantId, item.period, deps);
        if (outcome.status === "CREATED") result.created += 1;
      } catch {
        result.failed += 1;
      }
    }
    if (result.hasMore) break;
  }
  return result;
}
