import { NextResponse } from "next/server";
import { optimizeRound } from "@/domains/round/round-admin.service";
import { withApiHandler } from "@/lib/api/route-handler";
import { requireCompanyAdmin } from "@/lib/api/tenant-auth";

export const maxDuration = 30;

/** ADM-06 : recalcule l'ordre d'une tournée avec le calcul de tournées existant. */
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  return withApiHandler(async () => {
    const guard = await requireCompanyAdmin("rounds:manage");
    if ("error" in guard) return guard.error;
    const { id } = await params;
    const data = await optimizeRound({ companyId: guard.actor.companyId, userId: guard.actor.user.id }, id);
    return NextResponse.json({ data, success: true });
  });
}
