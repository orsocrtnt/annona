import { NextResponse } from "next/server";
import { moveStop } from "@/domains/round/round-admin.service";
import { readJsonBody, withApiHandler } from "@/lib/api/route-handler";
import { requireCompanyAdmin } from "@/lib/api/tenant-auth";
import { moveStopSchema } from "@/lib/validations/round";

/** ADM-06, critère 6 : déplace un arrêt vers une autre tournée du même créneau. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return withApiHandler(async () => {
    const guard = await requireCompanyAdmin("rounds:manage");
    if ("error" in guard) return guard.error;
    const { id } = await params;
    const input = moveStopSchema.parse(await readJsonBody(request));
    const data = await moveStop({ companyId: guard.actor.companyId, userId: guard.actor.user.id }, id, input);
    return NextResponse.json({ data, success: true });
  });
}
