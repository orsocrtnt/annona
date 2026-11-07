import { NextResponse } from "next/server";
import { createSlotForAdmin, listSlotsForAdmin } from "@/domains/company/slot-admin.service";
import { readJsonBody, withApiHandler } from "@/lib/api/route-handler";
import { requireCompanyAdmin } from "@/lib/api/tenant-auth";
import { createSlotSchema } from "@/lib/validations/company-admin";

/** ADM-09, RG-08 : créneaux de l'entreprise, actifs et désactivés, dans l'ordre. */
export async function GET() {
  return withApiHandler(async () => {
    const guard = await requireCompanyAdmin("settings:read");
    if ("error" in guard) return guard.error;
    return NextResponse.json({ data: await listSlotsForAdmin(guard.actor.companyId), success: true });
  });
}

export async function POST(request: Request) {
  return withApiHandler(async () => {
    const guard = await requireCompanyAdmin("settings:update");
    if ("error" in guard) return guard.error;
    const input = createSlotSchema.parse(await readJsonBody(request));
    return NextResponse.json({ data: await createSlotForAdmin(guard.actor.companyId, input), success: true }, { status: 201 });
  });
}
