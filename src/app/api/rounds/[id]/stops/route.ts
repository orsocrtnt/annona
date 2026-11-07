import { NextResponse } from "next/server";
import { reorderRoundStops } from "@/domains/round/round-admin.service";
import { readJsonBody, withApiHandler } from "@/lib/api/route-handler";
import { requireCompanyAdmin } from "@/lib/api/tenant-auth";
import { reorderStopsSchema } from "@/lib/validations/round";

/** ADM-06 : nouvel ordre complet des arrêts d'une tournée. */
export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return withApiHandler(async () => {
    const guard = await requireCompanyAdmin("rounds:manage");
    if ("error" in guard) return guard.error;
    const { id } = await params;
    const { stopIds } = reorderStopsSchema.parse(await readJsonBody(request));
    const data = await reorderRoundStops({ companyId: guard.actor.companyId, userId: guard.actor.user.id }, id, stopIds);
    return NextResponse.json({ data, success: true });
  });
}
