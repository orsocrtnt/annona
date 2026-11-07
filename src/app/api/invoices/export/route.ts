import { NextResponse } from "next/server";
import { exportInvoicesCsv } from "@/domains/invoice/invoice-export.service";
import { withApiHandler } from "@/lib/api/route-handler";
import { requireCompanyAdmin } from "@/lib/api/tenant-auth";
import { adminInvoiceListQuerySchema } from "@/lib/validations/invoice";

/** FACT-1 — export comptable CSV des factures filtrées (une ligne par facture, HT et TVA par taux). */
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
    const csv = await exportInvoicesCsv(guard.actor.companyId, filters);
    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="factures${filters.from ? `-${filters.from}` : ""}${filters.to ? `-${filters.to}` : ""}.csv"`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  });
}
