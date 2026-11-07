import { NextResponse } from "next/server";
import { getDriverRounds } from "@/domains/round/round-driver.service";
import { withApiHandler } from "@/lib/api/route-handler";
import { requireCompanyRole } from "@/lib/api/tenant-auth";

/** LIV-01, LIV-02 : tournées validées du livreur connecté (jamais celles d'un autre). */
export async function GET() {
  return withApiHandler(async () => {
    const guard = await requireCompanyRole(["DRIVER"], "rounds:read");
    if ("error" in guard) return guard.error;
    const data = await getDriverRounds({ companyId: guard.actor.companyId, userId: guard.actor.user.id });
    return NextResponse.json({ data, success: true }, { headers: { "Cache-Control": "private, no-store" } });
  });
}
