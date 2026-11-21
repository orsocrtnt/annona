import { NextResponse } from "next/server";
import { getShopPriceBoard, setShopPrices, verifyManagerCode, type ShopPricesDb } from "@/domains/shop/shop-prices.service";
import { readJsonBody, withApiHandler } from "@/lib/api/route-handler";
import { requireCompanyRole } from "@/lib/api/tenant-auth";
import { sellerShopPricesSchema, unlockShopPricesSchema } from "@/lib/validations/shop";
import { prisma } from "@/services/prisma/client";

const db = () => prisma as unknown as ShopPricesDb;

async function sellerShop() {
  const guard = await requireCompanyRole(["SELLER"], "dashboard:shop");
  if ("error" in guard) return guard;
  const shopId = guard.actor.user.merchantId;
  if (!shopId) return { error: NextResponse.json({ error: "Ce compte n'est rattaché à aucune boutique.", success: false }, { status: 403 }) };
  return { actor: guard.actor, shopId };
}

/**
 * Lot 2, demande 4 : ouvrir « Produits et prix » de la tablette avec le code responsable (POST, le code ne
 * passe jamais dans l'adresse). Sans le bon code : refusé (vérification 2).
 */
export async function POST(request: Request) {
  return withApiHandler(async () => {
    const seller = await sellerShop();
    if ("error" in seller) return seller.error;
    const { code } = unlockShopPricesSchema.parse(await readJsonBody(request));
    await verifyManagerCode(db(), seller.actor.companyId, seller.shopId, code);
    return NextResponse.json({ data: await getShopPriceBoard(seller.actor.companyId, seller.shopId, db()), success: true });
  });
}

/** Lot 2, demande 4, vérification 3 : la responsable enregistre les prix de sa boutique, avec son code. */
export async function PUT(request: Request) {
  return withApiHandler(async () => {
    const seller = await sellerShop();
    if ("error" in seller) return seller.error;
    const { code, prices } = sellerShopPricesSchema.parse(await readJsonBody(request));
    await verifyManagerCode(db(), seller.actor.companyId, seller.shopId, code);
    const data = await setShopPrices(db(), { companyId: seller.actor.companyId, userId: seller.actor.user.id }, seller.shopId, prices);
    return NextResponse.json({ data, success: true });
  });
}
