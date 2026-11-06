import { NextResponse } from "next/server";
import { deleteMerchantPrice } from "@/domains/catalog/catalog.service";
import { withApiHandler } from "@/lib/api/route-handler";
import { requireCompanyAdmin } from "@/lib/api/tenant-auth";

/** ADM-03 : supprimer un prix spécifique ; le client repasse au prix de base (RG-05). */
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  return withApiHandler(async () => {
    const guard = await requireCompanyAdmin("catalog:manage");
    if ("error" in guard) return guard.error;
    const { id } = await params;
    await deleteMerchantPrice(guard.actor.companyId, id);
    return NextResponse.json({ success: true });
  });
}
