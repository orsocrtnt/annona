import { NextResponse } from "next/server";
import { changeManagerCode, type ShopPricesDb } from "@/domains/shop/shop-prices.service";
import { readJsonBody, withApiHandler } from "@/lib/api/route-handler";
import { requireCompanyRole } from "@/lib/api/tenant-auth";
import { changeManagerCodeSchema } from "@/lib/validations/shop";
import { prisma } from "@/services/prisma/client";

/** Lot 2, demande 4 : la responsable change son code en donnant l'ancien. */
export async function PUT(request: Request) {
  return withApiHandler(async () => {
    const guard = await requireCompanyRole(["SELLER"], "dashboard:shop");
    if ("error" in guard) return guard.error;
    const shopId = guard.actor.user.merchantId;
    if (!shopId) return NextResponse.json({ error: "Ce compte vente n'est rattaché à aucune boutique.", success: false }, { status: 403 });
    const { currentCode, newCode } = changeManagerCodeSchema.parse(await readJsonBody(request));
    await changeManagerCode(prisma as unknown as ShopPricesDb, { companyId: guard.actor.companyId, userId: guard.actor.user.id, shopId }, currentCode, newCode);
    return NextResponse.json({ success: true });
  });
}
