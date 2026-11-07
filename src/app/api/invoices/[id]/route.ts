import { NextResponse } from "next/server";
import { getAdminInvoice } from "@/domains/invoice/invoice-query.service";
import { withApiHandler } from "@/lib/api/route-handler";
import { requireCompanyAdmin } from "@/lib/api/tenant-auth";
import { getTransactionalEmailConfiguration } from "@/lib/email/transactional-email";

/** FACT-1 — fiche facture (ADM-10) : lignes, commandes incluses, règlements, envoi, mentions manquantes. */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  return withApiHandler(async () => {
    const guard = await requireCompanyAdmin("invoices:read");
    if ("error" in guard) return guard.error;
    const { id } = await params;
    const data = await getAdminInvoice(guard.actor.companyId, id, { emailConfigured: getTransactionalEmailConfiguration().enabled });
    return NextResponse.json({ data, success: true });
  });
}
