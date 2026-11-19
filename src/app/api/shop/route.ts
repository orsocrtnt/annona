import { NextResponse } from "next/server";
import { getSellerShop } from "@/domains/shop/shop.service";
import { withApiHandler } from "@/lib/api/route-handler";
import { requireCompanyRole } from "@/lib/api/tenant-auth";

/** Lot 2, demande 1 : la boutique de la vendeuse connectée, et seulement la sienne (vérification 2). */
export async function GET() {
  return withApiHandler(async () => {
    const guard = await requireCompanyRole(["SELLER"], "dashboard:shop");
    if ("error" in guard) return guard.error;
    const data = await getSellerShop({ companyId: guard.actor.companyId, merchantId: guard.actor.user.merchantId ?? null });
    return NextResponse.json({ data, success: true });
  });
}
