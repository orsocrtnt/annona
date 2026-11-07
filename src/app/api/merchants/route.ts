import { NextResponse } from "next/server";
import { createMerchantForAdmin, listMerchantsForAdmin } from "@/domains/merchant/merchant-admin.service";
import { readJsonBody, withApiHandler } from "@/lib/api/route-handler";
import { requireCompanyAdmin } from "@/lib/api/tenant-auth";
import { createMerchantSchema } from "@/lib/validations/company-admin";

/** ADM-1 : clients de l'entreprise (recherche `q`, `status=active|inactive|all`). */
export async function GET(request: Request) {
  return withApiHandler(async () => {
    const guard = await requireCompanyAdmin("merchants:read");
    if ("error" in guard) return guard.error;
    const params = new URL(request.url).searchParams;
    const status = params.get("status");
    const data = await listMerchantsForAdmin(guard.actor.companyId, {
      q: params.get("q"),
      status: status === "active" || status === "inactive" ? status : "all",
    });
    return NextResponse.json({ data, success: true });
  });
}

/** ADM-1 : nouveau client (raison sociale, adresse géocodée, consignes, contact, facturation). */
export async function POST(request: Request) {
  return withApiHandler(async () => {
    const guard = await requireCompanyAdmin("merchants:manage");
    if ("error" in guard) return guard.error;
    const input = createMerchantSchema.parse(await readJsonBody(request));
    const data = await createMerchantForAdmin({ companyId: guard.actor.companyId, userId: guard.actor.user.id }, input);
    return NextResponse.json({ data, success: true }, { status: 201 });
  });
}
