import { NextResponse } from "next/server";
import { listMerchantChoices } from "@/domains/catalog/catalog.service";
import { withApiHandler } from "@/lib/api/route-handler";
import { requireCompanyAdmin } from "@/lib/api/tenant-auth";

/** ADM-03 : clients de l'entreprise, pour choisir à qui attribuer un prix spécifique. */
export async function GET() {
  return withApiHandler(async () => {
    const guard = await requireCompanyAdmin("catalog:manage");
    if ("error" in guard) return guard.error;
    return NextResponse.json({ data: await listMerchantChoices(guard.actor.companyId), success: true });
  });
}
