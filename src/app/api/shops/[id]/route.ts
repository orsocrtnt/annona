import { NextResponse } from "next/server";
import { getShop, updateShop } from "@/domains/shop/shop.service";
import { readJsonBody, withApiHandler } from "@/lib/api/route-handler";
import { requireCompanyAdmin } from "@/lib/api/tenant-auth";
import { updateShopSchema } from "@/lib/validations/shop";

/** Lot 2, demande 1 : fiche d'une boutique ; une boutique d'une autre entreprise : 404. */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  return withApiHandler(async () => {
    const guard = await requireCompanyAdmin("shops:read");
    if ("error" in guard) return guard.error;
    const { id } = await params;
    return NextResponse.json({ data: await getShop(guard.actor.companyId, id), success: true });
  });
}

/** Lot 2, demande 1 : modification ou désactivation (`active: false`), journalisée. */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return withApiHandler(async () => {
    const guard = await requireCompanyAdmin("shops:manage");
    if ("error" in guard) return guard.error;
    const { id } = await params;
    const input = updateShopSchema.parse(await readJsonBody(request));
    const data = await updateShop({ companyId: guard.actor.companyId, userId: guard.actor.user.id }, id, input);
    return NextResponse.json({ data, success: true });
  });
}
