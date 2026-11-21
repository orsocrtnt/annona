import { NextResponse } from "next/server";
import { setManagerCode, type ShopPricesDb } from "@/domains/shop/shop-prices.service";
import { readJsonBody, withApiHandler } from "@/lib/api/route-handler";
import { requireCompanyAdmin } from "@/lib/api/tenant-auth";
import { setManagerCodeSchema } from "@/lib/validations/shop";
import { prisma } from "@/services/prisma/client";

/** Lot 2, demande 4 : l'administrateur réinitialise le code responsable oublié d'une boutique. */
export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return withApiHandler(async () => {
    const guard = await requireCompanyAdmin("shops:manage");
    if ("error" in guard) return guard.error;
    const { id } = await params;
    const { code } = setManagerCodeSchema.parse(await readJsonBody(request));
    await setManagerCode(prisma as unknown as ShopPricesDb, { companyId: guard.actor.companyId, userId: guard.actor.user.id }, id, code);
    return NextResponse.json({ success: true });
  });
}
