import { NextResponse } from "next/server";
import { reorderSlotsForAdmin } from "@/domains/company/slot-admin.service";
import { readJsonBody, withApiHandler } from "@/lib/api/route-handler";
import { requireCompanyAdmin } from "@/lib/api/tenant-auth";
import { reorderSlotsSchema } from "@/lib/validations/company-admin";

/** ADM-09 : ordre d'affichage des créneaux (portail client, tournées). */
export async function PUT(request: Request) {
  return withApiHandler(async () => {
    const guard = await requireCompanyAdmin("settings:update");
    if ("error" in guard) return guard.error;
    const { ids } = reorderSlotsSchema.parse(await readJsonBody(request));
    return NextResponse.json({ data: await reorderSlotsForAdmin(guard.actor.companyId, ids), success: true });
  });
}
