import { NextResponse } from "next/server";
import { ensureDateLocked } from "@/domains/order/order-lock.service";
import { getProductionDay } from "@/domains/production/production.service";
import { withApiHandler } from "@/lib/api/route-handler";
import { requireCompanyRole } from "@/lib/api/tenant-auth";
import { dayQuerySchema } from "@/lib/validations/order";

/**
 * BOU-01 à BOU-03 : production d'un jour pour le boulanger. Après l'heure limite, la date est
 * verrouillée d'abord (LOCK-1, appel paresseux) puis le total, les bons et les tournées sont rendus ;
 * avant, seulement un total provisoire marqué comme tel.
 */
export async function GET(request: Request) {
  return withApiHandler(async () => {
    const guard = await requireCompanyRole(["BAKER"], "production:read");
    if ("error" in guard) return guard.error;
    const { date } = dayQuerySchema.parse({ date: new URL(request.url).searchParams.get("date") });
    const day = await ensureDateLocked(guard.actor.companyId, date);
    return NextResponse.json({ data: await getProductionDay(guard.actor.companyId, day), success: true });
  });
}
