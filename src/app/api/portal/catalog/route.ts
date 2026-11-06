import { NextResponse } from "next/server";
import { getMerchantCatalog } from "@/domains/order/merchant-catalog.service";
import { merchantRef } from "@/lib/api/merchant-ref";
import { withApiHandler } from "@/lib/api/route-handler";
import { requireMerchantActor } from "@/lib/api/tenant-auth";

/** CLI-03 : catalogue par catégorie au prix appliqué du client (RG-05), créneaux (RG-08) et dates. */
export async function GET() {
  return withApiHandler(async () => {
    const guard = await requireMerchantActor();
    if ("error" in guard) return guard.error;
    return NextResponse.json({ data: await getMerchantCatalog(merchantRef(guard.actor)), success: true });
  });
}
