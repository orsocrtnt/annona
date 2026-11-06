import { NextResponse } from "next/server";
import { getMerchantProfile } from "@/domains/order/merchant-catalog.service";
import { merchantRef } from "@/lib/api/merchant-ref";
import { withApiHandler } from "@/lib/api/route-handler";
import { requireMerchantActor } from "@/lib/api/tenant-auth";

/** CLI-02 : profil du commerce du client connecté. */
export async function GET() {
  return withApiHandler(async () => {
    const guard = await requireMerchantActor();
    if ("error" in guard) return guard.error;
    return NextResponse.json({ data: await getMerchantProfile(merchantRef(guard.actor)), success: true });
  });
}
