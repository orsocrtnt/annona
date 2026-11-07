/**
 * FACT-1 (CLI-10) — relevé de factures d'un commerçant sur une période choisie (jour, semaine, mois,
 * année) : récapitulatif des factures dont la période commence dans cette période, avec totaux TTC,
 * réglé et reste. PDF simple ; le détail et les mentions légales sont sur chaque facture.
 */
import type { BillingPeriod } from "@prisma/client";
import { periodShortLabel } from "@/domains/invoice/billing-period";
import { listMerchantInvoices, type InvoiceQueryDb } from "@/domains/invoice/invoice-query.service";
import { readCompanyLogo } from "@/domains/company/company-logo.service";
import { SETTLEMENT_LABELS } from "@/lib/constants/invoice-status";
import { generateStatementPdf } from "@/lib/pdf/statement-pdf";
import { prisma } from "@/services/prisma/client";

export async function renderMerchantStatementPdf(
  actor: { companyId: string; merchantId: string },
  input: { periodType: BillingPeriod; date: string },
  now = new Date(),
  db: InvoiceQueryDb = prisma
): Promise<{ pdf: Uint8Array; filename: string }> {
  const list = await listMerchantInvoices(actor, input, now, db);
  const [company, merchant] = await Promise.all([
    db.company.findUnique({ where: { id: actor.companyId }, select: { name: true, legalName: true, email: true } }),
    db.merchant.findFirst({ where: { id: actor.merchantId, companyId: actor.companyId }, select: { name: true, tradeName: true } }),
  ]);
  const companyLogoPng = await readCompanyLogo(actor.companyId).catch(() => null);
  const pdf = await generateStatementPdf({
    companyName: company?.legalName || company?.name || "",
    companyEmail: company?.email ?? null,
    companyLogoPng,
    merchantName: merchant ? merchant.tradeName || merchant.name : "",
    periodLabel: list.period.label,
    issuedAt: now,
    invoices: list.invoices.map((invoice) => ({
      reference: invoice.reference,
      period: periodShortLabel({ type: invoice.periodType, start: invoice.periodStart, end: invoice.periodEnd }),
      issuedAt: invoice.issuedAt,
      dueDate: invoice.dueDate,
      total: invoice.totalCents / 100,
      paid: invoice.paidCents / 100,
      remaining: invoice.remainingCents / 100,
      status: invoice.status === "OVERDUE" && invoice.remainingCents > 0 ? "En retard" : SETTLEMENT_LABELS[invoice.settlement],
    })),
    totals: { total: list.totals.totalCents / 100, paid: list.totals.paidCents / 100, remaining: list.totals.remainingCents / 100 },
  });
  return { pdf, filename: `releve-${list.period.type.toLowerCase()}-${list.period.start}.pdf` };
}
