import { NextResponse } from "next/server";
import { renderMerchantStatementPdf } from "@/domains/invoice/invoice-statement.service";
import { withApiHandler } from "@/lib/api/route-handler";
import { requireMerchantActor } from "@/lib/api/tenant-auth";
import { portalInvoiceQuerySchema } from "@/lib/validations/invoice";

export const runtime = "nodejs";

/** FACT-1 (CLI-10) — relevé PDF des factures du commerçant connecté sur une période choisie. */
export async function GET(request: Request) {
  return withApiHandler(async () => {
    const guard = await requireMerchantActor();
    if ("error" in guard) return guard.error;
    const params = new URL(request.url).searchParams;
    const input = portalInvoiceQuerySchema.parse({ periodType: params.get("periodType"), date: params.get("date") });
    const { pdf, filename } = await renderMerchantStatementPdf(guard.actor, input);
    return new NextResponse(Buffer.from(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${filename}"`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  });
}
