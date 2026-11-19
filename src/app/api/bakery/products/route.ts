import { NextResponse } from "next/server";
import { listLabProducts, withoutRecipe } from "@/domains/catalog/lab-catalog.service";
import { withApiHandler } from "@/lib/api/route-handler";
import { requireCompanyRole } from "@/lib/api/tenant-auth";

/** Lot 2, demande 3 : le pain de l'entreprise et sa durée de vente, pour le boulanger (jamais de recette). */
export async function GET() {
  return withApiHandler(async () => {
    const guard = await requireCompanyRole(["BAKER"], "catalog:bread");
    if ("error" in guard) return guard.error;
    return NextResponse.json({ data: withoutRecipe(await listLabProducts(guard.actor.companyId, "BREAD")), success: true });
  });
}
