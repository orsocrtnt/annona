import { NextResponse } from "next/server";
import { createPromotion, listPromotions } from "@/domains/catalog/promotion.service";
import { readJsonBody, withApiHandler } from "@/lib/api/route-handler";
import { requireCompanyAdmin } from "@/lib/api/tenant-auth";
import { createPromotionSchema } from "@/lib/validations/catalog";

/** Lot 1, demande 2 : promotions de l'entreprise, en cours puis terminées. */
export async function GET() {
  return withApiHandler(async () => {
    const guard = await requireCompanyAdmin("catalog:read");
    if ("error" in guard) return guard.error;
    return NextResponse.json({ data: await listPromotions(guard.actor.companyId), success: true });
  });
}

/** Lot 1, demande 2 : crée une promotion sur un produit. */
export async function POST(request: Request) {
  return withApiHandler(async () => {
    const guard = await requireCompanyAdmin("catalog:manage");
    if ("error" in guard) return guard.error;
    const input = createPromotionSchema.parse(await readJsonBody(request));
    const data = await createPromotion({ companyId: guard.actor.companyId, userId: guard.actor.user.id }, input);
    return NextResponse.json({ data, success: true }, { status: 201 });
  });
}
