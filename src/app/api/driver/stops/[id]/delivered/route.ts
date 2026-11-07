import { NextResponse } from "next/server";
import { markStopDelivered } from "@/domains/round/round-driver.service";
import { readJsonBody, withApiHandler } from "@/lib/api/route-handler";
import { requireCompanyRole } from "@/lib/api/tenant-auth";
import { deliveredSchema } from "@/lib/validations/round";

/** LIV-03 : « Livré », horodaté au moment de l'appui. Idempotent (LIV-06 : rejeu sans doublon). */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return withApiHandler(async () => {
    const guard = await requireCompanyRole(["DRIVER"], "stops:update");
    if ("error" in guard) return guard.error;
    const { id } = await params;
    const { at } = deliveredSchema.parse(await readJsonBody(request));
    const data = await markStopDelivered({ companyId: guard.actor.companyId, userId: guard.actor.user.id }, id, { at });
    return NextResponse.json({ data, success: true });
  });
}
