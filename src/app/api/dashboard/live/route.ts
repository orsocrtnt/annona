import { NextResponse } from "next/server";
import { getLiveDashboard } from "@/domains/round/round-live.service";
import { withApiHandler } from "@/lib/api/route-handler";
import { requireCompanyAdmin } from "@/lib/api/tenant-auth";

/** ADM-04, ADM-08 : suivi en direct du jour (rafraîchi par l'écran toutes les 15 s). */
export async function GET() {
  return withApiHandler(async () => {
    const guard = await requireCompanyAdmin("rounds:read");
    if ("error" in guard) return guard.error;
    return NextResponse.json({ data: await getLiveDashboard(guard.actor.companyId), success: true });
  });
}
