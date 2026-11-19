import { NextResponse } from "next/server";
import { createShop, listShops } from "@/domains/shop/shop.service";
import { readJsonBody, withApiHandler } from "@/lib/api/route-handler";
import { requireCompanyAdmin } from "@/lib/api/tenant-auth";
import { createShopSchema } from "@/lib/validations/shop";

/** Lot 2, demande 1 : boutiques de l'entreprise, avec leurs comptes vendeuse. */
export async function GET() {
  return withApiHandler(async () => {
    const guard = await requireCompanyAdmin("shops:read");
    if ("error" in guard) return guard.error;
    return NextResponse.json({ data: await listShops(guard.actor.companyId), success: true });
  });
}

/** Lot 2, demande 1 : nouvelle boutique (nom, adresse, consignes d'accès, tournée). */
export async function POST(request: Request) {
  return withApiHandler(async () => {
    const guard = await requireCompanyAdmin("shops:manage");
    if ("error" in guard) return guard.error;
    const input = createShopSchema.parse(await readJsonBody(request));
    const data = await createShop({ companyId: guard.actor.companyId, userId: guard.actor.user.id }, input);
    return NextResponse.json({ data, success: true }, { status: 201 });
  });
}
