import { NextResponse } from "next/server";
import { listAdminInvoices } from "@/domains/invoice/invoice-query.service";
import { withApiHandler } from "@/lib/api/route-handler";
import { requireCompanyAdmin } from "@/lib/api/tenant-auth";
import { adminInvoiceListQuerySchema } from "@/lib/validations/invoice";

/** FACT-1 — liste des factures de l'entreprise (ADM-10), filtrable par période, client et règlement. */
export async function GET(request: Request) {
  return withApiHandler(async () => {
    const guard = await requireCompanyAdmin("invoices:read");
    if ("error" in guard) return guard.error;
    const params = new URL(request.url).searchParams;
    const filters = adminInvoiceListQuerySchema.parse({
      from: params.get("from"),
      to: params.get("to"),
      merchantId: params.get("merchantId"),
      status: params.get("status"),
    });
    return NextResponse.json({ data: await listAdminInvoices(guard.actor.companyId, filters), success: true });
  });
}
