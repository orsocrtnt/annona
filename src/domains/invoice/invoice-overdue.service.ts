import type { PrismaClient } from "@prisma/client";
import { prisma } from "@/services/prisma/client";
import { startOfParisDay } from "@/domains/invoice/invoice-due";

type OverdueDatabase = Pick<PrismaClient, "invoice">;

/**
 * Passe en OVERDUE les factures PENDING dont le jour d'échéance est passé.
 * Une seule mise à jour conditionnelle : le statut PENDING est réévalué par
 * PostgreSQL sur chaque ligne verrouillée, donc une facture payée, annulée,
 * brouillon ou sans échéance n'est jamais touchée, même si le paiement est
 * validé pendant le passage. Idempotent : un rejeu ne trouve plus rien.
 */
export async function markOverdueInvoices(
  options: { now?: Date; companyId?: string } = {},
  db: OverdueDatabase = prisma
): Promise<number> {
  const cutoff = startOfParisDay(options.now ?? new Date());
  const result = await db.invoice.updateMany({
    where: {
      status: "PENDING",
      dueDate: { lt: cutoff },
      ...(options.companyId ? { companyId: options.companyId } : {}),
    },
    data: { status: "OVERDUE" },
  });
  return result.count;
}
