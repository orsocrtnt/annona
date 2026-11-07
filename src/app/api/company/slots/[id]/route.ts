import { NextResponse } from "next/server";
import { deleteSlotForAdmin, updateSlotForAdmin } from "@/domains/company/slot-admin.service";
import { readJsonBody, withApiHandler } from "@/lib/api/route-handler";
import { requireCompanyAdmin } from "@/lib/api/tenant-auth";
import { updateSlotSchema } from "@/lib/validations/company-admin";

/** ADM-09 : modifier ou désactiver un créneau (`active: false`). */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return withApiHandler(async () => {
    const guard = await requireCompanyAdmin("settings:update");
    if ("error" in guard) return guard.error;
    const { id } = await params;
    const input = updateSlotSchema.parse(await readJsonBody(request));
    return NextResponse.json({ data: await updateSlotForAdmin(guard.actor.companyId, id, input), success: true });
  });
}

/** Suppression d'un créneau jamais utilisé ; un créneau utilisé : 409 (le désactiver). */
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  return withApiHandler(async () => {
    const guard = await requireCompanyAdmin("settings:update");
    if ("error" in guard) return guard.error;
    const { id } = await params;
    return NextResponse.json({ data: await deleteSlotForAdmin(guard.actor.companyId, id), success: true });
  });
}
