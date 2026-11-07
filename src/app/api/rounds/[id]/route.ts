import { NextResponse } from "next/server";
import { assignRoundDriver, deleteRound } from "@/domains/round/round-admin.service";
import { readJsonBody, withApiHandler } from "@/lib/api/route-handler";
import { requireCompanyAdmin } from "@/lib/api/tenant-auth";
import { assignDriverSchema } from "@/lib/validations/round";

type Params = { params: Promise<{ id: string }> };

/** ADM-07 : attribue, change ou retire le livreur d'une tournée. */
export async function PATCH(request: Request, { params }: Params) {
  return withApiHandler(async () => {
    const guard = await requireCompanyAdmin("rounds:manage");
    if ("error" in guard) return guard.error;
    const { id } = await params;
    const { driverId } = assignDriverSchema.parse(await readJsonBody(request));
    const data = await assignRoundDriver({ companyId: guard.actor.companyId, userId: guard.actor.user.id }, id, driverId);
    return NextResponse.json({ data, success: true });
  });
}

/** ADM-06 : supprime une tournée vide. */
export async function DELETE(_request: Request, { params }: Params) {
  return withApiHandler(async () => {
    const guard = await requireCompanyAdmin("rounds:manage");
    if ("error" in guard) return guard.error;
    const { id } = await params;
    const data = await deleteRound({ companyId: guard.actor.companyId, userId: guard.actor.user.id }, id);
    return NextResponse.json({ data, success: true });
  });
}
