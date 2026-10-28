import type { InvoiceStatus, PrismaClient } from "@prisma/client";
import { prisma } from "@/services/prisma/client";
import { COMPANY_INVOICES_TAKE } from "@/lib/query/list-limits";
import { invoiceDaysOverdue, isInvoiceOutstanding } from "@/domains/invoice/invoice-due";
import { markOverdueInvoices } from "@/domains/invoice/invoice-overdue.service";
import { effectiveReminderResult, reminderBlocksNewOne } from "@/domains/invoice/invoice-reminder.service";

export const COMPANY_INVOICE_FILTERS = ["ALL", "PENDING", "OVERDUE", "PAID"] as const;
export type CompanyInvoiceFilter = (typeof COMPANY_INVOICE_FILTERS)[number];

export type CompanyInvoiceRow = {
  id: string;
  reference: string;
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

type ListDatabase = Pick<PrismaClient, "invoice">;

/**
 * Paiements côté entreprise (DEMO-3). La consultation passe d'abord en retard les
 * factures échues de l'entreprise (même mise à jour conditionnelle que le cron),
 * pour que la liste soit juste même si le filet cron n'est pas encore passé.
 */
export async function listCompanyInvoices(
  companyId: string,
  options: { status: CompanyInvoiceFilter; now?: Date },
  db: ListDatabase = prisma
): Promise<CompanyInvoiceList> {
  const now = options.now ?? new Date();
  await markOverdueInvoices({ companyId, now }, db);

  const [rows, groups] = await Promise.all([
    db.invoice.findMany({
      where: { companyId, ...(options.status === "ALL" ? {} : { status: options.status }) },
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
          select: { result: true, channel: true, createdAt: true, operationJob: { select: { status: true } } },
        },
      },
    }),
    db.invoice.groupBy({
      by: ["status"],
      where: { companyId, status: { in: ["PAID", "PENDING", "OVERDUE"] } },
      _count: { _all: true },
    }),
  ]);

  const counts = { PAID: 0, PENDING: 0, OVERDUE: 0 };
  for (const group of groups) {
    if (group.status in counts) counts[group.status as keyof typeof counts] = group._count._all;
  }

  return {
    counts,
    limit: COMPANY_INVOICES_TAKE,
    invoices: rows.map((row) => {
      const last = row.reminders[0] ?? null;
      const outstanding = isInvoiceOutstanding(row.status);
      return {
        id: row.id,
        reference: row.reference,
        status: row.status,
        amount: Number(row.amount),
        dueDate: row.dueDate?.toISOString() ?? null,
        paidAt: row.paidAt?.toISOString() ?? null,
        createdAt: row.createdAt.toISOString(),
        daysOverdue: row.status === "OVERDUE" ? invoiceDaysOverdue(row.dueDate, now) : 0,
        customerName: row.customer ? `${row.customer.firstName} ${row.customer.lastName}`.trim() : null,
        orderId: row.orderId,
        orderReference: row.order?.reference ?? null,
        lastReminder: last
          ? { createdAt: last.createdAt.toISOString(), result: effectiveReminderResult(last), channel: last.channel }
          : null,
        canRemind: outstanding && !(last && reminderBlocksNewOne(last, now)),
      };
    }),
  };
}
