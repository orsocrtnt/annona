import type { Prisma } from "@prisma/client";

/**
 * Numérotation continue des factures, par entreprise (AUDIT-0111, C2 ; ENF-05).
 *
 * Le numéro est pris dans la transaction qui crée la facture : un échec l'annule avec elle, et le
 * verrou de la ligne `invoice_counters` fait attendre une émission concurrente. La suite reste donc
 * continue, sans trou ni doublon (unicité `invoices(company_id, number)` en dernier rempart).
 */
export async function nextInvoiceNumber(tx: Pick<Prisma.TransactionClient, "$queryRaw">, companyId: string) {
  const rows = await tx.$queryRaw<Array<{ last_number: number }>>`
    INSERT INTO "invoice_counters" ("company_id", "last_number") VALUES (${companyId}, 1)
    ON CONFLICT ("company_id") DO UPDATE
      SET "last_number" = "invoice_counters"."last_number" + 1, "updated_at" = CURRENT_TIMESTAMP
    RETURNING "last_number"`;
  const number = rows[0]?.last_number;
  if (!number) throw new Error("INVOICE_COUNTER_FAILED");
  return number;
}

/** Forme affichée : préfixe de l'entreprise et numéro sur six chiffres au moins (« FAC-000042 »). */
export function formatInvoiceReference(prefix: string, number: number) {
  return `${prefix}-${String(number).padStart(6, "0")}`;
}
