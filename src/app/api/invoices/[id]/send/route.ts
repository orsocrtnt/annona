import { NextResponse } from "next/server";
import { requestInvoiceEmail } from "@/domains/invoice/invoice-email.service";
import { withApiHandler } from "@/lib/api/route-handler";
import { requireCompanyAdmin } from "@/lib/api/tenant-auth";

/** FACT-1 — « Envoyer » / « Renvoyer » la facture par e-mail au client (ADM-10), PDF joint. */
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  return withApiHandler(async () => {
    const guard = await requireCompanyAdmin("invoices:update");
    if ("error" in guard) return guard.error;
    const { id } = await params;
    const data = await requestInvoiceEmail({ companyId: guard.actor.companyId }, id);
    return NextResponse.json({ data, success: true }, { status: 202 });
  });
}
