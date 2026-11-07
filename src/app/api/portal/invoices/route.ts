import { NextResponse } from "next/server";
import { listMerchantInvoices } from "@/domains/invoice/invoice-query.service";
import { withApiHandler } from "@/lib/api/route-handler";
import { requireMerchantActor } from "@/lib/api/tenant-auth";
import { portalInvoiceQuerySchema } from "@/lib/validations/invoice";

/** FACT-1 (CLI-10) — factures du commerçant connecté, par période (jour, semaine, mois, année). */
export async function GET(request: Request) {
  return withApiHandler(async () => {
    const guard = await requireMerchantActor();
    if ("error" in guard) return guard.error;
    const params = new URL(request.url).searchParams;
    const input = portalInvoiceQuerySchema.parse({ periodType: params.get("periodType"), date: params.get("date") });
    return NextResponse.json({ data: await listMerchantInvoices(guard.actor, input), success: true });
  });
}
