import { NextResponse } from "next/server";
import { deleteZoneForAdmin, updateZoneForAdmin } from "@/domains/company/delivery-zone.service";
import { readJsonBody, withApiHandler } from "@/lib/api/route-handler";
import { requireCompanyAdmin } from "@/lib/api/tenant-auth";
import { updateZoneSchema } from "@/lib/validations/company-admin";

/** Lot 1, demande 1 : modifier une tournée ou la désactiver (`active: false`). */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return withApiHandler(async () => {
    const guard = await requireCompanyAdmin("settings:update");
    if ("error" in guard) return guard.error;
    const { id } = await params;
    const input = updateZoneSchema.parse(await readJsonBody(request));
    return NextResponse.json({ data: await updateZoneForAdmin(guard.actor.companyId, id, input), success: true });
  });
}

/** Suppression d'une tournée jamais utilisée ; sinon 409 (la désactiver). */
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  return withApiHandler(async () => {
    const guard = await requireCompanyAdmin("settings:update");
    if ("error" in guard) return guard.error;
    const { id } = await params;
    return NextResponse.json({ data: await deleteZoneForAdmin(guard.actor.companyId, id), success: true });
  });
}
