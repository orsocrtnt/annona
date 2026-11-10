import { NextResponse } from "next/server";
import { getDriverTracking } from "@/domains/round/driver-tracking.service";
import { withApiHandler } from "@/lib/api/route-handler";
import { requireCompanyAdmin } from "@/lib/api/tenant-auth";

/** Lot 1, demande 5 : livreurs en tournée, leur position, leurs prochains arrêts et leurs livraisons. */
export async function GET() {
  return withApiHandler(async () => {
    const guard = await requireCompanyAdmin("tracking:read");
    if ("error" in guard) return guard.error;
    return NextResponse.json({ data: await getDriverTracking(guard.actor.companyId), success: true }, { headers: { "Cache-Control": "no-store" } });
  });
}
