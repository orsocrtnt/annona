import { NextResponse } from "next/server";
import { updatePastryProduct } from "@/domains/catalog/lab-catalog.service";
import { readJsonBody, withApiHandler } from "@/lib/api/route-handler";
import { requireCompanyRole } from "@/lib/api/tenant-auth";
import { updatePastryProductSchema } from "@/lib/validations/catalog";

/** Lot 2, demande 3 : le pâtissier modifie une pâtisserie (jamais ses prix). */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return withApiHandler(async () => {
    const guard = await requireCompanyRole(["PASTRY_CHEF"], "catalog:pastry");
    if ("error" in guard) return guard.error;
    const { id } = await params;
    const input = updatePastryProductSchema.parse(await readJsonBody(request));
    return NextResponse.json({ data: await updatePastryProduct(guard.actor.companyId, id, input), success: true });
  });
}
