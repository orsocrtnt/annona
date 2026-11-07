import { NextResponse } from "next/server";
import { validateRounds } from "@/domains/round/round-admin.service";
import { readJsonBody, withApiHandler } from "@/lib/api/route-handler";
import { requireCompanyAdmin } from "@/lib/api/tenant-auth";
import { validateRoundsSchema } from "@/lib/validations/round";

/** ADM-07 : valide les tournées d'un jour qui ont un livreur ; les livreurs sont notifiés. */
export async function POST(request: Request) {
  return withApiHandler(async () => {
    const guard = await requireCompanyAdmin("rounds:manage");
    if ("error" in guard) return guard.error;
    const { date } = validateRoundsSchema.parse(await readJsonBody(request));
    const data = await validateRounds({ companyId: guard.actor.companyId, userId: guard.actor.user.id }, date);
    return NextResponse.json({ data, success: true });
  });
}
