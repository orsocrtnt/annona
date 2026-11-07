import { NextResponse } from "next/server";
import { startRound } from "@/domains/round/round-driver.service";
import { readJsonBody, withApiHandler } from "@/lib/api/route-handler";
import { requireCompanyRole } from "@/lib/api/tenant-auth";
import { deliveredSchema } from "@/lib/validations/round";

/** « Démarrer la tournée » (le jour même). Idempotent : rejouable par la file hors réseau. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return withApiHandler(async () => {
    const guard = await requireCompanyRole(["DRIVER"], "stops:update");
    if ("error" in guard) return guard.error;
    const { id } = await params;
    const { at } = deliveredSchema.parse(await readJsonBody(request));
    const data = await startRound({ companyId: guard.actor.companyId, userId: guard.actor.user.id }, id, { at });
    return NextResponse.json({ data, success: true });
  });
}
