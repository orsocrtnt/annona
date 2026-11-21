import { NextResponse } from "next/server";
import { getShopPriceBoard, setShopPrices, type ShopPricesDb } from "@/domains/shop/shop-prices.service";
import { readJsonBody, withApiHandler } from "@/lib/api/route-handler";
import { requireCompanyAdmin } from "@/lib/api/tenant-auth";
import { shopPricesSchema } from "@/lib/validations/shop";
import { prisma } from "@/services/prisma/client";

/** Lot 2, demande 4 : prix boutique d'une boutique, vus par l'administrateur (sans code responsable). */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  return withApiHandler(async () => {
    const guard = await requireCompanyAdmin("shops:read");
    if ("error" in guard) return guard.error;
    const { id } = await params;
    return NextResponse.json({ data: await getShopPriceBoard(guard.actor.companyId, id), success: true });
  });
}

/** Lot 2, demande 4, vérification 6 : l'administrateur modifie les prix boutique ; la tablette les relit aussitôt. */
export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return withApiHandler(async () => {
    const guard = await requireCompanyAdmin("shops:manage");
    if ("error" in guard) return guard.error;
    const { id } = await params;
    const { prices } = shopPricesSchema.parse(await readJsonBody(request));
    const data = await setShopPrices(prisma as unknown as ShopPricesDb, { companyId: guard.actor.companyId, userId: guard.actor.user.id }, id, prices);
    return NextResponse.json({ data, success: true });
  });
}
