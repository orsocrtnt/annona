import { NextResponse } from "next/server";
import { createZoneForAdmin, listZonesForAdmin } from "@/domains/company/delivery-zone.service";
import { readJsonBody, withApiHandler } from "@/lib/api/route-handler";
import { requireCompanyAdmin } from "@/lib/api/tenant-auth";
import { createZoneSchema } from "@/lib/validations/company-admin";

/** Lot 1, demande 1 : tournées de l'entreprise (zone, plage du matin, plage du soir). */
export async function GET() {
  return withApiHandler(async () => {
    const guard = await requireCompanyAdmin("settings:read");
    if ("error" in guard) return guard.error;
    return NextResponse.json({ data: await listZonesForAdmin(guard.actor.companyId), success: true });
  });
}

export async function POST(request: Request) {
  return withApiHandler(async () => {
    const guard = await requireCompanyAdmin("settings:update");
    if ("error" in guard) return guard.error;
    const input = createZoneSchema.parse(await readJsonBody(request));
    return NextResponse.json({ data: await createZoneForAdmin(guard.actor.companyId, input), success: true }, { status: 201 });
  });
}
