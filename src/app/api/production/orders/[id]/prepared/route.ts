import { NextResponse } from "next/server";
import { setOrderPrepared } from "@/domains/production/production.service";
import { readJsonBody, withApiHandler } from "@/lib/api/route-handler";
import { requireCompanyRole } from "@/lib/api/tenant-auth";
import { preparedSchema } from "@/lib/validations/order";

/** BOU-05 : le boulanger coche (ou décoche) « préparée ». */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return withApiHandler(async () => {
    const guard = await requireCompanyRole(["BAKER"], "production:update");
    if ("error" in guard) return guard.error;
    const { id } = await params;
    const { prepared } = preparedSchema.parse(await readJsonBody(request));
    const data = await setOrderPrepared({ companyId: guard.actor.companyId, userId: guard.actor.user.id }, id, prepared);
    return NextResponse.json({ data, success: true });
  });
}
