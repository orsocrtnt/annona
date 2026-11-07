import { NextResponse } from "next/server";
import { getMerchantForAdmin, updateMerchantForAdmin } from "@/domains/merchant/merchant-admin.service";
import { readJsonBody, withApiHandler } from "@/lib/api/route-handler";
import { requireCompanyAdmin } from "@/lib/api/tenant-auth";
import { updateMerchantSchema } from "@/lib/validations/company-admin";

/** ADM-1 : fiche d'un client de l'entreprise, avec ses comptes ; un client d'une autre entreprise : 404. */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  return withApiHandler(async () => {
    const guard = await requireCompanyAdmin("merchants:read");
    if ("error" in guard) return guard.error;
    const { id } = await params;
    return NextResponse.json({ data: await getMerchantForAdmin(guard.actor.companyId, id), success: true });
  });
}

/** ADM-1 : modification ou désactivation (`active: false`), journalisée. */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return withApiHandler(async () => {
    const guard = await requireCompanyAdmin("merchants:manage");
    if ("error" in guard) return guard.error;
    const { id } = await params;
    const input = updateMerchantSchema.parse(await readJsonBody(request));
    const data = await updateMerchantForAdmin({ companyId: guard.actor.companyId, userId: guard.actor.user.id }, id, input);
    return NextResponse.json({ data, success: true });
  });
}
