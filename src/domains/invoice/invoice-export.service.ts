/**
 * FACT-1 — export comptable CSV (ADM-10) : une ligne par facture, HT et TVA par taux, TTC, réglé,
 * reste, statut. Séparateur « ; » et virgule décimale (ouverture directe dans un tableur français).
 * Mêmes filtres que la liste ; l'entreprise vient toujours de la session.
 */
import { listAdminInvoices, type AdminInvoiceFilters, type InvoiceQueryDb } from "@/domains/invoice/invoice-query.service";
import { vatOf } from "@/domains/invoice/invoice-builder";
import { SETTLEMENT_LABELS } from "@/lib/constants/invoice-status";
import { prisma } from "@/services/prisma/client";

const amount = (cents: number) => (cents / 100).toFixed(2).replace(".", ",");
const rateLabel = (basisPoints: number) => `${(basisPoints / 100).toLocaleString("fr-FR", { maximumFractionDigits: 2 })} %`;

/** Champ CSV : guillemets doublés ; une formule de tableur en tête est neutralisée. */
export function csvField(value: string): string {
  const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return /[";\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

export async function exportInvoicesCsv(companyId: string, filters: AdminInvoiceFilters, now = new Date(), db: InvoiceQueryDb = prisma): Promise<string> {
  const { invoices } = await listAdminInvoices(companyId, filters, now, db);
  const lines = invoices.length
    ? await db.invoiceLine.findMany({
        where: { companyId, invoiceId: { in: invoices.map((invoice) => invoice.id) } },
        select: { invoiceId: true, vatRateBasisPoints: true, totalCents: true },
      })
    : [];
  const rates = [...new Set(lines.map((line) => line.vatRateBasisPoints))].sort((a, b) => a - b);
  const header = [
    "Numéro", "Date d'émission", "Client", "Période début", "Période fin",
    ...rates.flatMap((rate) => [`HT ${rateLabel(rate)}`, `TVA ${rateLabel(rate)}`]),
    "Total HT", "TVA", "Total TTC", "Réglé", "Reste", "Règlement", "Échéance",
  ];
  const day = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("fr-FR", { timeZone: "Europe/Paris" }) : "");
  const rows = [...invoices].sort((a, b) => a.number - b.number).map((invoice) => {
    const own = lines.filter((line) => line.invoiceId === invoice.id);
    const perRate = rates.flatMap((rate) => {
      const base = own.filter((line) => line.vatRateBasisPoints === rate).reduce((sum, line) => sum + line.totalCents, 0);
      return [amount(base), amount(vatOf(base, rate))];
    });
    return [
      invoice.reference, day(invoice.issuedAt), invoice.merchant.name, invoice.periodStart, invoice.periodEnd,
      ...perRate,
      amount(invoice.subtotalCents), amount(invoice.vatCents), amount(invoice.totalCents), amount(invoice.paidCents), amount(invoice.remainingCents),
      SETTLEMENT_LABELS[invoice.settlement], day(invoice.dueDate),
    ];
  });
  // BOM UTF-8 : accents lisibles à l'ouverture dans un tableur.
  return `﻿${[header, ...rows].map((row) => row.map(csvField).join(";")).join("\r\n")}\r\n`;
}
