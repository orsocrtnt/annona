/** Résumés en mots des graphiques d'analyse : ce qu'un lecteur d'écran lit, et ce que l'œil retient. */

import type { InvoiceStatus } from "@prisma/client";
import { effectiveInvoiceStatus } from "@/domains/invoice/invoice-due";

export type DailyVolume = { date: string; count: number };

export function volumeSummary(rows: DailyVolume[]) {
  const total = rows.reduce((sum, row) => sum + row.count, 0);
  const peak = rows.reduce<DailyVolume | null>((best, row) => (row.count > (best?.count ?? 0) ? row : best), null);
  const average = rows.length ? total / rows.length : 0;
  return { total, peak, average };
}

/** Part encaissée du total facturé, en pourcentage entier ; null sans facture. */
export function collectedShare(collected: number, invoiced: number): number | null {
  if (invoiced <= 0) return null;
  return Math.round((collected / invoiced) * 100);
}

/**
 * Répartition du facturé. Brouillons et annulées n'ont rien à encaisser et sortent du total, qui égale
 * donc toujours encaissé + en attente + en retard. Une facture échue compte en retard dès le lendemain
 * de son échéance, comme dans Paiements (ANALYSE-ENCAISSE).
 */
export function splitInvoicedAmounts(
  invoices: { status: InvoiceStatus; amount: number; dueDate: Date | string | null }[],
  now: Date = new Date()
) {
  const totals = { collectedAmount: 0, pendingInvoiceAmount: 0, overdueInvoiceAmount: 0 };
  for (const invoice of invoices) {
    const { status } = effectiveInvoiceStatus(invoice, now);
    if (status === "PAID") totals.collectedAmount += invoice.amount;
    else if (status === "PENDING") totals.pendingInvoiceAmount += invoice.amount;
    else if (status === "OVERDUE") totals.overdueInvoiceAmount += invoice.amount;
  }
  return {
    ...totals,
    invoicedAmount: totals.collectedAmount + totals.pendingInvoiceAmount + totals.overdueInvoiceAmount,
  };
}
