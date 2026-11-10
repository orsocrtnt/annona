import { NextResponse } from "next/server";
import { listMerchantChoices } from "@/domains/catalog/catalog.service";
import { withApiHandler } from "@/lib/api/route-handler";
import { requireCompanyAdminAny } from "@/lib/api/tenant-auth";

/**
 * ADM-03 : clients de l'entreprise, pour choisir à qui attribuer un prix spécifique. Lot 1, demandes 2 et 4 :
 * aussi pour une promotion réservée et pour rattacher un compte client.
 */
export async function GET() {
  return withApiHandler(async () => {
    const guard = await requireCompanyAdminAny(["catalog:manage", "promotions:manage", "users:create", "users:update"]);
    if ("error" in guard) return guard.error;
    return NextResponse.json({ data: await listMerchantChoices(guard.actor.companyId), success: true });
  });
}
