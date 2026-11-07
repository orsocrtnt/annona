import { NextResponse } from "next/server";
import { reportShortage } from "@/domains/production/production.service";
import { readJsonBody, withApiHandler } from "@/lib/api/route-handler";
import { requireCompanyRole } from "@/lib/api/tenant-auth";
import { shortageSchema } from "@/lib/validations/order";

/** BOU-06 : manquant ou quantité réduite sur une ligne (quantité livrée), journalisé (RG-06, RG-10). */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return withApiHandler(async () => {
    const guard = await requireCompanyRole(["BAKER"], "production:update");
    if ("error" in guard) return guard.error;
    const { id } = await params;
    const { quantityDelivered } = shortageSchema.parse(await readJsonBody(request));
    const data = await reportShortage({ companyId: guard.actor.companyId, userId: guard.actor.user.id }, id, quantityDelivered);
    return NextResponse.json({ data, success: true });
  });
}
