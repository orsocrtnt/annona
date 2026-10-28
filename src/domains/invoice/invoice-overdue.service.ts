import { Prisma, type PrismaClient } from "@prisma/client";
import { prisma } from "@/services/prisma/client";
import { startOfParisDay } from "@/domains/invoice/invoice-due";

type OverdueDatabase = Pick<PrismaClient, "$executeRaw">;

/**
 * Passe en OVERDUE les factures PENDING dont le jour d'échéance (Paris) est passé.
 * C'est un état calculé par le système, pas une édition : `updated_at` n'est pas
 * touché, donc « Marquer payée » ou l'annulation avec la version lue avant le
 * passage ne tombent pas en conflit. Requête brute paramétrée (Prisma ne permet
 * pas d'écrire sans `@updatedAt`), conditionnée sur `status = 'PENDING'` : une
 * facture payée, annulée, brouillon ou sans échéance n'est jamais touchée, même si
 * le paiement est validé pendant le passage. Idempotent. Seul le cron l'appelle.
 */
export async function markOverdueInvoices(
  options: { now?: Date; companyId?: string } = {},
  db: OverdueDatabase = prisma
): Promise<number> {
  const cutoff = startOfParisDay(options.now ?? new Date());
  const company = options.companyId ? Prisma.sql` AND "company_id" = ${options.companyId}` : Prisma.empty;
  return db.$executeRaw`UPDATE "invoices" SET "status" = 'OVERDUE'::"InvoiceStatus" WHERE "status" = 'PENDING'::"InvoiceStatus" AND "due_date" < ${cutoff}${company}`;
}
