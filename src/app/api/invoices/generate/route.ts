import { NextResponse } from "next/server";
import { generateInvoicesForPeriod } from "@/domains/invoice/invoice-generation.service";
import { readJsonBody, withApiHandler } from "@/lib/api/route-handler";
import { requireCompanyAdmin } from "@/lib/api/tenant-auth";
import { generateInvoicesSchema } from "@/lib/validations/invoice";

/**
 * FACT-1 — bouton « Générer les factures » (ADM-10) : une facture par client de la périodicité choisie
 * (ou un seul), sur ses commandes livrées et non facturées de la période. Idempotent ; chaque facture
 * créée part par e-mail (tâche durable).
 */
export async function POST(request: Request) {
  return withApiHandler(async () => {
    const guard = await requireCompanyAdmin("invoices:create");
    if ("error" in guard) return guard.error;
    const input = generateInvoicesSchema.parse(await readJsonBody(request));
    const result = await generateInvoicesForPeriod({ companyId: guard.actor.companyId, actorId: guard.actor.user.id }, input);
    return NextResponse.json({
      data: {
        period: result.period,
        created: result.created.map(({ id, reference, merchantName, totalCents, orderCount }) => ({ id, reference, merchantName, totalCents, orderCount })),
        nothingToBill: result.nothingToBill,
        skipped: result.skipped,
      },
      success: true,
    });
  });
}
