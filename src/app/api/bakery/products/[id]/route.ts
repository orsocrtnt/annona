import { NextResponse } from "next/server";
import { updateBreadShelfLife, withoutRecipe } from "@/domains/catalog/lab-catalog.service";
import { readJsonBody, withApiHandler } from "@/lib/api/route-handler";
import { requireCompanyRole } from "@/lib/api/tenant-auth";
import { updateShelfLifeSchema } from "@/lib/validations/catalog";

/** Lot 2, demande 3 : le boulanger règle la durée de vente d'un pain. */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return withApiHandler(async () => {
    const guard = await requireCompanyRole(["BAKER"], "catalog:bread");
    if ("error" in guard) return guard.error;
    const { id } = await params;
    const { shelfLifeDays } = updateShelfLifeSchema.parse(await readJsonBody(request));
    const [row] = withoutRecipe([await updateBreadShelfLife(guard.actor.companyId, id, shelfLifeDays)]);
    return NextResponse.json({ data: row, success: true });
  });
}
