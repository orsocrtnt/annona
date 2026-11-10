/**
 * FACT-1 — lectures des factures : liste et fiche du back-office (ADM-10), liste et relevé du portail
 * commerçant (CLI-10). Toute requête impose l'entreprise de la session (PLA-01) et, au portail, le
 * commerçant du compte : un commerçant ne voit jamais la facture d'un autre.
 */
import type { BillingPeriod, Prisma } from "@prisma/client";
import { dbDateKey, periodContaining, periodDateToDb, periodLabel } from "@/domains/invoice/billing-period";
import { deliveredAmountCents, vatOf } from "@/domains/invoice/invoice-builder";
import { effectiveInvoiceStatus, isInvoiceOutstanding } from "@/domains/invoice/invoice-due";
import { invoiceEmailAttempt, invoiceEmailJobPrefix } from "@/domains/invoice/invoice-email-keys";
import { invoiceLegalGaps, type InvoiceLegalGap } from "@/domains/invoice/invoice-legal";
import { settlementStatus } from "@/domains/invoice/invoice-settlement";
import type {
  AdminInvoiceDetail,
  AdminInvoiceList,
  InvoiceEmailStatus,
  InvoiceListItem,
  PortalInvoiceList,
} from "@/domains/invoice/invoice.types";
import { DomainRuleError } from "@/lib/errors/domain-rule-error";
import { fr } from "@/lib/i18n/fr";
import { parseStoredEinvoicingSettings } from "@/lib/validations/einvoicing";
import { prisma } from "@/services/prisma/client";

const t = fr.invoices.errors;
const LIST_LIMIT = 500;

export type InvoiceQueryDb = Pick<
  Prisma.TransactionClient,
  "company" | "merchant" | "invoice" | "invoiceLine" | "payment" | "order" | "orderLine" | "operationJob" | "user"
>;

type InvoiceRow = {
  id: string;
  reference: string;
  number: number;
  merchantId: string;
  periodType: BillingPeriod;
  periodStart: Date;
  periodEnd: Date;
  issuedAt: Date;
  dueDate: Date | null;
  subtotalCents: number;
  vatCents: number;
  totalCents: number;
  status: AdminInvoiceDetail["status"];
};

const INVOICE_SELECT = {
  id: true,
  reference: true,
  number: true,
  merchantId: true,
  periodType: true,
  periodStart: true,
  periodEnd: true,
  issuedAt: true,
  dueDate: true,
  subtotalCents: true,
  vatCents: true,
  totalCents: true,
  status: true,
} as const;

const merchantName = (merchant: { name: string; tradeName?: string | null } | undefined) => (merchant ? merchant.tradeName || merchant.name : "");

async function paidByInvoice(db: InvoiceQueryDb, companyId: string, invoiceIds: string[]) {
  const paid = new Map<string, number>();
  if (invoiceIds.length === 0) return paid;
  const payments = await db.payment.findMany({ where: { companyId, invoiceId: { in: invoiceIds } }, select: { invoiceId: true, amountCents: true } });
  for (const payment of payments) paid.set(payment.invoiceId, (paid.get(payment.invoiceId) ?? 0) + payment.amountCents);
  return paid;
}

function toListItem(row: InvoiceRow, merchant: { id: string; name: string }, paidCents: number, now: Date): InvoiceListItem {
  const effective = effectiveInvoiceStatus(row, now);
  const period = { type: row.periodType, start: dbDateKey(row.periodStart), end: dbDateKey(row.periodEnd) };
  return {
    id: row.id,
    reference: row.reference,
    number: row.number,
    merchant,
    periodType: row.periodType,
    periodStart: period.start,
    periodEnd: period.end,
    periodLabel: periodLabel(period),
    issuedAt: row.issuedAt.toISOString(),
    dueDate: row.dueDate?.toISOString() ?? null,
    subtotalCents: row.subtotalCents,
    vatCents: row.vatCents,
    totalCents: row.totalCents,
    paidCents,
    remainingCents: Math.max(0, row.totalCents - paidCents),
    status: effective.status,
    settlement: row.status === "CANCELLED" ? "PAID" : settlementStatus(row.totalCents, paidCents),
    daysOverdue: effective.daysOverdue,
  };
}

function sumTotals(items: InvoiceListItem[]) {
  const live = items.filter((item) => item.status !== "CANCELLED");
  return {
    totalCents: live.reduce((sum, item) => sum + item.totalCents, 0),
    paidCents: live.reduce((sum, item) => sum + item.paidCents, 0),
    remainingCents: live.reduce((sum, item) => sum + item.remainingCents, 0),
  };
}

/** Mentions légales manquantes de l'entreprise (ENF-05) : pour un relevé avec TVA (cas courant). */
export async function companyLegalGaps(db: Pick<InvoiceQueryDb, "company">, companyId: string, options = { hasVat: true, hasExempt: false }): Promise<InvoiceLegalGap[]> {
  const company = await db.company.findUnique({
    where: { id: companyId },
    select: { name: true, legalName: true, siren: true, siret: true, email: true, billingAddress: true, billingPostalCode: true, billingCity: true, country: true, settings: true },
  });
  if (!company) return [];
  const settings = (company.settings ?? {}) as Record<string, unknown>;
  const { settings: einvoicing } = parseStoredEinvoicingSettings(settings.einvoicing);
  const seller = {
    name: company.name,
    legalName: company.legalName,
    siren: company.siren,
    siret: company.siret,
    email: company.email,
    billingAddress: company.billingAddress,
    billingPostalCode: company.billingPostalCode,
    billingCity: company.billingCity,
    country: company.country,
  };
  return invoiceLegalGaps(seller, einvoicing, options);
}

export type AdminInvoiceStatusFilter = "TO_PAY" | "PARTIAL" | "PAID" | "OVERDUE";

export interface AdminInvoiceFilters {
  /** Factures dont la période recoupe [from, to] (« AAAA-MM-JJ »). */
  from?: string | null;
  to?: string | null;
  merchantId?: string | null;
  status?: AdminInvoiceStatusFilter | null;
}

export async function listAdminInvoices(companyId: string, filters: AdminInvoiceFilters, now = new Date(), db: InvoiceQueryDb = prisma): Promise<AdminInvoiceList> {
  const where: Prisma.InvoiceWhereInput = { companyId };
  if (filters.merchantId) where.merchantId = filters.merchantId;
  if (filters.from) where.periodEnd = { gte: periodDateToDb(filters.from) };
  if (filters.to) where.periodStart = { lte: periodDateToDb(filters.to) };
  if (filters.status === "PAID") where.status = "PAID";
  else if (filters.status) where.status = { in: ["PENDING", "OVERDUE"] };

  const [rows, merchants, legalGaps] = await Promise.all([
    db.invoice.findMany({ where, select: INVOICE_SELECT, orderBy: [{ number: "desc" }], take: LIST_LIMIT + 1 }),
    db.merchant.findMany({ where: { companyId }, select: { id: true, name: true, tradeName: true, billingPeriod: true } }),
    companyLegalGaps(db, companyId),
  ]);
  const truncated = rows.length > LIST_LIMIT;
  const kept = (rows as InvoiceRow[]).slice(0, LIST_LIMIT).sort((a, b) => b.number - a.number);
  const paid = await paidByInvoice(db, companyId, kept.map((row) => row.id));
  const byId = new Map(merchants.map((merchant) => [merchant.id, merchant]));
  let invoices = kept.map((row) => toListItem(row, { id: row.merchantId, name: merchantName(byId.get(row.merchantId)) }, paid.get(row.id) ?? 0, now));
  if (filters.status === "TO_PAY") invoices = invoices.filter((item) => item.settlement === "TO_PAY");
  if (filters.status === "PARTIAL") invoices = invoices.filter((item) => item.settlement === "PARTIAL");
  if (filters.status === "OVERDUE") invoices = invoices.filter((item) => item.status === "OVERDUE");
  return {
    invoices,
    merchants: merchants
      .map((merchant) => ({ id: merchant.id, name: merchantName(merchant), billingPeriod: merchant.billingPeriod }))
      .sort((a, b) => a.name.localeCompare(b.name, "fr")),
    totals: sumTotals(invoices),
    legalGaps,
    truncated,
  };
}

/** Dernière tentative d'envoi de la facture par e-mail (tâche durable), lue telle quelle. */
export function emailStatusFromJob(job: { jobKey: string; status: string; lastError: string | null; updatedAt: Date; payload: unknown } | null): InvoiceEmailStatus | null {
  if (!job) return null;
  const error = job.lastError ?? "";
  const payload = (job.payload ?? {}) as Record<string, unknown>;
  // Destinataire figé à la première tentative émise (instantané du rendu, voir operation-job.service.ts).
  const snapshot = (payload.emailSnapshot ?? {}) as Record<string, unknown>;
  const recipient = typeof snapshot.to === "string" ? snapshot.to : null;
  let state: InvoiceEmailStatus["state"];
  if (job.status === "SUCCEEDED") {
    state = error.includes("INVOICE_EMAIL_DISABLED") ? "NOT_CONFIGURED" : error.includes("INVOICE_EMAIL_NO_RECIPIENT") ? "NO_RECIPIENT" : "SENT";
  } else if (job.status === "FAILED") state = "FAILED";
  else state = "PENDING";
  return { state, attempt: invoiceEmailAttempt(job.jobKey), at: job.updatedAt.toISOString(), recipient };
}

export async function latestInvoiceEmailJob(db: Pick<InvoiceQueryDb, "operationJob">, companyId: string, invoiceId: string) {
  const jobs = await db.operationJob.findMany({
    where: { companyId, jobKey: { startsWith: invoiceEmailJobPrefix(invoiceId) } },
    select: { jobKey: true, status: true, lastError: true, updatedAt: true, payload: true },
  });
  return jobs.sort((a, b) => invoiceEmailAttempt(b.jobKey) - invoiceEmailAttempt(a.jobKey))[0] ?? null;
}

export async function getAdminInvoice(
  companyId: string,
  invoiceId: string,
  options: { now?: Date; emailConfigured?: boolean } = {},
  db: InvoiceQueryDb = prisma
): Promise<AdminInvoiceDetail> {
  const now = options.now ?? new Date();
  const row = (await db.invoice.findFirst({ where: { id: invoiceId, companyId }, select: INVOICE_SELECT })) as InvoiceRow | null;
  if (!row) throw new DomainRuleError(404, t.notFound, "INVOICE_NOT_FOUND");

  const [merchant, lines, payments, orders, emailJob] = await Promise.all([
    db.merchant.findFirst({
      where: { id: row.merchantId, companyId },
      select: { id: true, name: true, tradeName: true, address: true, postalCode: true, city: true, billingAddress: true, billingPostalCode: true, billingCity: true, billingEmail: true, contactEmail: true },
    }),
    db.invoiceLine.findMany({
      where: { companyId, invoiceId },
      select: { label: true, unit: true, quantity: true, unitPriceCents: true, vatRateBasisPoints: true, totalCents: true, sortOrder: true },
      orderBy: [{ sortOrder: "asc" }],
    }),
    db.payment.findMany({
      where: { companyId, invoiceId },
      select: { id: true, amountCents: true, method: true, paidAt: true, note: true, recordedById: true },
      orderBy: [{ paidAt: "asc" }],
    }),
    db.order.findMany({ where: { companyId, invoiceId }, select: { id: true, reference: true, deliveryDate: true } }),
    latestInvoiceEmailJob(db, companyId, invoiceId),
  ]);
  const orderLines = orders.length
    ? await db.orderLine.findMany({
        where: { companyId, orderId: { in: orders.map((order) => order.id) } },
        select: { orderId: true, quantityOrdered: true, quantityDelivered: true, unitPriceFrozenCents: true, promoQuantity: true, promoUnitPriceCents: true },
      })
    : [];
  const recorders = payments.some((payment) => payment.recordedById)
    ? await db.user.findMany({
        where: { companyId, id: { in: payments.map((payment) => payment.recordedById).filter((id): id is string => Boolean(id)) } },
        select: { id: true, firstName: true, lastName: true },
      })
    : [];
  const recorderName = new Map(recorders.map((user) => [user.id, [user.firstName, user.lastName].filter(Boolean).join(" ")]));

  const paidCents = payments.reduce((sum, payment) => sum + payment.amountCents, 0);
  const sortedLines = [...lines].sort((a, b) => a.sortOrder - b.sortOrder);
  const byRate = new Map<number, number>();
  for (const line of sortedLines) byRate.set(line.vatRateBasisPoints, (byRate.get(line.vatRateBasisPoints) ?? 0) + line.totalCents);
  const vatBreakdown = [...byRate.entries()].sort(([a], [b]) => a - b).map(([rate, base]) => ({ vatRateBasisPoints: rate, baseCents: base, vatCents: vatOf(base, rate) }));
  const hasVat = sortedLines.some((line) => line.vatRateBasisPoints > 0);
  const hasExempt = sortedLines.some((line) => line.vatRateBasisPoints === 0);
  const item = toListItem(row, { id: row.merchantId, name: merchantName(merchant ?? undefined) }, paidCents, now);

  return {
    ...item,
    merchant: {
      id: row.merchantId,
      name: merchantName(merchant ?? undefined),
      address: merchant
        ? [merchant.billingAddress ?? merchant.address, [merchant.billingPostalCode ?? merchant.postalCode, merchant.billingCity ?? merchant.city].filter(Boolean).join(" ")].filter(Boolean).join(", ")
        : "",
      billingEmail: merchant?.billingEmail ?? merchant?.contactEmail ?? null,
    },
    lines: sortedLines.map((line) => ({
      label: line.label,
      unit: line.unit,
      quantity: line.quantity,
      unitPriceCents: line.unitPriceCents,
      vatRateBasisPoints: line.vatRateBasisPoints,
      totalCents: line.totalCents,
    })),
    vatBreakdown,
    orders: orders
      .map((order) => {
        const own = orderLines.filter((line) => line.orderId === order.id);
        return {
          id: order.id,
          reference: order.reference,
          deliveryDate: dbDateKey(order.deliveryDate),
          subtotalCents: own.reduce((sum, line) => sum + deliveredAmountCents(line), 0),
          shortage: own.some((line) => line.quantityDelivered !== null && line.quantityDelivered < line.quantityOrdered),
        };
      })
      .sort((a, b) => a.deliveryDate.localeCompare(b.deliveryDate) || a.reference.localeCompare(b.reference)),
    payments: payments.map((payment) => ({
      id: payment.id,
      amountCents: payment.amountCents,
      method: payment.method,
      paidAt: payment.paidAt.toISOString(),
      reference: payment.note,
      recordedBy: payment.recordedById ? recorderName.get(payment.recordedById) || null : null,
    })),
    legalGaps: await companyLegalGaps(db, companyId, { hasVat, hasExempt }),
    email: emailStatusFromJob(emailJob),
    emailConfigured: options.emailConfigured ?? false,
    canRemind: isInvoiceOutstanding(item.status) && item.remainingCents > 0,
  };
}

/** CLI-10 : factures du commerçant dont la période commence dans la période choisie (jour, semaine, mois, année). */
export async function listMerchantInvoices(
  actor: { companyId: string; merchantId: string },
  input: { periodType: BillingPeriod; date: string },
  now = new Date(),
  db: InvoiceQueryDb = prisma
): Promise<PortalInvoiceList> {
  const merchant = await db.merchant.findFirst({ where: { id: actor.merchantId, companyId: actor.companyId }, select: { id: true, name: true, tradeName: true, billingPeriod: true } });
  if (!merchant) throw new DomainRuleError(404, t.merchantNotFound, "MERCHANT_NOT_FOUND");
  const range = periodContaining(input.periodType, input.date);
  const rows = (await db.invoice.findMany({
    where: {
      companyId: actor.companyId,
      merchantId: actor.merchantId,
      status: { not: "DRAFT" },
      periodStart: { gte: periodDateToDb(range.start), lte: periodDateToDb(range.end) },
    },
    select: INVOICE_SELECT,
    orderBy: [{ number: "desc" }],
    take: LIST_LIMIT,
  })) as InvoiceRow[];
  const paid = await paidByInvoice(db, actor.companyId, rows.map((row) => row.id));
  const invoices = rows
    .sort((a, b) => b.number - a.number)
    .map((row) => toListItem(row, { id: merchant.id, name: merchantName(merchant) }, paid.get(row.id) ?? 0, now));
  return {
    period: { ...range, label: periodLabel(range) },
    merchantPeriodicity: merchant.billingPeriod,
    invoices,
    totals: sumTotals(invoices),
  };
}
