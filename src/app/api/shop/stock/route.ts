import { NextResponse } from "next/server";
import { getShopStock } from "@/domains/shop/shop-stock.service";
import { withApiHandler } from "@/lib/api/route-handler";
import { requireCompanyRole } from "@/lib/api/tenant-auth";

async function seller() {
  const guard = await requireCompanyRole(["SELLER"], "dashboard:shop");
  if ("error" in guard) return guard;
  const shopId = guard.actor.user.merchantId;
  if (!shopId) return { error: NextResponse.json({ error: "Ce compte n'est rattaché à aucun point de vente.", success: false }, { status: 403 }) };
  return { actor: { companyId: guard.actor.companyId, userId: guard.actor.user.id, shopId } };
}

/** Lot 2, demande 8 : la vendeuse voit le stock de sa boutique seulement. */
export async function GET(request: Request) {
  return withApiHandler(async () => {
    const allowed = await seller();
    if ("error" in allowed) return allowed.error;
    const date = new URL(request.url).searchParams.get("date");
    return NextResponse.json({ data: await getShopStock(allowed.actor.companyId, { shopId: allowed.actor.shopId, date }), success: true });
  });
}
