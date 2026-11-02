import type { InvoiceStatus, Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "@/services/prisma/client";
import { COMPANY_INVOICES_TAKE } from "@/lib/query/list-limits";
import { effectiveInvoiceStatus, isInvoiceOutstanding, startOfParisDay } from "@/domains/invoice/invoice-due";
import {
  blockingReminderCandidatesWhere,
  effectiveReminderResult,
  firstBlockingReminder,
} from "@/domains/invoice/invoice-reminder.service";

export const COMPANY_INVOICE_FILTERS = ["ALL", "PENDING", "OVERDUE", "PAID"] as const;
export type CompanyInvoiceFilter = (typeof COMPANY_INVOICE_FILTERS)[number];

export type CompanyInvoiceRow = {
  id: string;
  reference: string;
  /** Statut affiché : PENDING échue = OVERDUE (calculé à la lecture). */
  status: InvoiceStatus;
  amount: number;
  dueDate: string | null;
  paidAt: string | null;
  createdAt: string;
  daysOverdue: number;
  customerName: string | null;
  orderId: string | null;
  orderReference: string | null;
  lastReminder: { createdAt: string; result: string; channel: string } | null;
  canRemind: boolean;
};

export type CompanyInvoiceList = {
  invoices: CompanyInvoiceRow[];
  counts: { PAID: number; PENDING: number; OVERDUE: number };
  limit: number;
};

type ListDatabase = Pick<PrismaClient, "invoice" | "invoiceReminder">;

/**
 * Paiements côté entreprise (DEMO-3). Lecture seule : une facture PENDING dont le
 * jour d'échéance (Paris) est passé s'affiche et se filtre « en retard », avec le
 * même calcul que le passage en retard ; seul le cron enregistre le statut. La
 * liste reste donc juste même si le cron est arrêté.
 */
export async function listCompanyInvoices(
  companyId: string,
  options: { status: CompanyInvoiceFilter; now?: Date },
  db: ListDatabase = prisma
): Promise<CompanyInvoiceList> {
  const now = options.now ?? new Date();
  const cutoff = startOfParisDay(now);
  const overdue: Prisma.InvoiceWhereInput = {
    OR: [{ status: "OVERDUE" }, { status: "PENDING", dueDate: { lt: cutoff } }],
  };
  const pending: Prisma.InvoiceWhereInput = {
    status: "PENDING",
    OR: [{ dueDate: null }, { dueDate: { gte: cutoff } }],
  };
  const filters: Record<CompanyInvoiceFilter, Prisma.InvoiceWhereInput> = {
    ALL: {},
    PENDING: pending,
    OVERDUE: overdue,
    PAID: { status: "PAID" },
  };

  const [rows, paidCount, pendingCount, overdueCount] = await Promise.all([
    db.invoice.findMany({
      where: { companyId, ...filters[options.status] },
      orderBy: { createdAt: "desc" },
      take: COMPANY_INVOICES_TAKE,
      select: {
        id: true,
        reference: true,
        status: true,
        amount: true,
        dueDate: true,
        paidAt: true,
        createdAt: true,
        orderId: true,
        order: { select: { reference: true } },
        customer: { select: { firstName: true, lastName: true } },
        reminders: {
          orderBy: { createdAt: "desc" },
          take: 1,
          select: { result: true, channel: true, createdAt: true, completedAt: true, operationJob: { select: { status: true, lastError: true } } },
        },
      },
    }),
    db.invoice.count({ where: { companyId, ...filters.PAID } }),
    db.invoice.count({ where: { companyId, ...pending } }),
    db.invoice.count({ where: { companyId, ...overdue } }),
  ]);

  // « Relancer » suit exactement la règle du serveur : toute relance bloquante, pas seulement la dernière.
  const outstandingIds = rows.filter((row) => isInvoiceOutstanding(row.status)).map((row) => row.id);
  const candidates = outstandingIds.length
    ? await db.invoiceReminder.findMany({
        where: { companyId, invoiceId: { in: outstandingIds }, ...blockingReminderCandidatesWhere(now) },
        orderBy: { createdAt: "desc" },
        select: { invoiceId: true, result: true, createdAt: true, completedAt: true, operationJob: { select: { status: true, lastError: true } } },
      })
    : [];
  const blocked = new Set(
    outstandingIds.filter((id) => firstBlockingReminder(candidates.filter((row) => row.invoiceId === id), now))
  );

  return {
    counts: { PAID: paidCount, PENDING: pendingCount, OVERDUE: overdueCount },
    limit: COMPANY_INVOICES_TAKE,
    invoices: rows.map((row) => {
      const last = row.reminders[0] ?? null;
      const outstanding = isInvoiceOutstanding(row.status);
      const { status, daysOverdue } = effectiveInvoiceStatus(row, now);
      return {
        id: row.id,
        reference: row.reference,
        status,
        amount: Number(row.amount),
        dueDate: row.dueDate?.toISOString() ?? null,
        paidAt: row.paidAt?.toISOString() ?? null,
        createdAt: row.createdAt.toISOString(),
        daysOverdue,
        customerName: row.customer ? `${row.customer.firstName} ${row.customer.lastName}`.trim() : null,
        orderId: row.orderId,
        orderReference: row.order?.reference ?? null,
        lastReminder: last
          ? { createdAt: last.createdAt.toISOString(), result: effectiveReminderResult(last, now), channel: last.channel }
          : null,
        canRemind: outstanding && !blocked.has(row.id),
      };
    }),
  };
}

export type UnissuedDeliveryInvoice = { orderId: string; orderReference: string; reason: string };

const UNISSUED_REASONS: Record<string, (postalCode: string | null) => string> = {
  DELIVERY_INVOICE_EMPTY: (postalCode) =>
    `Aucune zone tarifaire ne correspond au code postal ${postalCode ?? "de livraison"}, et la commande n'a pas d'achat.`,
  INVOICE_AMOUNT_TOO_LARGE: () => "Le montant dépasse la limite d'une facture.",
};

/**
 * Commandes livrées que la facture automatique n'a pas pu facturer, et qui n'ont toujours pas de
 * facture : l'entreprise doit le voir là où elle suit ses paiements (FACT-AUTO-VIDE).
 */
export async function listUnissuedDeliveryInvoices(
  companyId: string,
  db: Pick<PrismaClient, "operationJob" | "order"> = prisma
): Promise<UnissuedDeliveryInvoice[]> {
  const jobs = await db.operationJob.findMany({
    where: { companyId, type: "DELIVERY_INVOICE", status: "FAILED", lastError: { in: Object.keys(UNISSUED_REASONS) } },
    orderBy: { updatedAt: "desc" },
    take: 50,
    select: { payload: true, lastError: true },
  });
  const errorByOrder = new Map<string, string>();
  for (const job of jobs) {
    const orderId = (job.payload as { orderId?: unknown } | null)?.orderId;
    if (typeof orderId === "string" && job.lastError && !errorByOrder.has(orderId)) errorByOrder.set(orderId, job.lastError);
  }
  if (errorByOrder.size === 0) return [];
  const orders = await db.order.findMany({
    where: { companyId, id: { in: [...errorByOrder.keys()] }, invoices: { none: { status: { not: "CANCELLED" } } } },
    select: { id: true, reference: true, shippingPostalCode: true },
  });
  return orders.map((order) => ({
    orderId: order.id,
    orderReference: order.reference,
    reason: UNISSUED_REASONS[errorByOrder.get(order.id) ?? ""]?.(order.shippingPostalCode) ?? "Facture non émise.",
  }));
}
