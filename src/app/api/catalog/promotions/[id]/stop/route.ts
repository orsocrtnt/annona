import { NextResponse } from "next/server";
import { stopPromotion } from "@/domains/catalog/promotion.service";
import { withApiHandler } from "@/lib/api/route-handler";
import { requireCompanyAdmin } from "@/lib/api/tenant-auth";

/** Lot 1, demande 2 : arrête une promotion tout de suite (les commandes validées gardent leur prix). */
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  return withApiHandler(async () => {
    const guard = await requireCompanyAdmin("promotions:manage");
    if ("error" in guard) return guard.error;
    const { id } = await params;
    const data = await stopPromotion({ companyId: guard.actor.companyId, userId: guard.actor.user.id }, id);
    return NextResponse.json({ data, success: true });
  });
}
