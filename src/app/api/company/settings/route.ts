import { NextResponse } from "next/server";
import { getCompanySettings, updateCompanySettings } from "@/domains/company/company-settings.service";
import { readJsonBody, withApiHandler } from "@/lib/api/route-handler";
import { requireCompanyAdmin } from "@/lib/api/tenant-auth";
import { companySettingsSchema } from "@/lib/validations/company-admin";

/** ADM-09, PLA-03, PLA-04 : nom, heure limite, fuseau, délai du rappel, unités proposées. */
export async function GET() {
  return withApiHandler(async () => {
    const guard = await requireCompanyAdmin("settings:read");
    if ("error" in guard) return guard.error;
    return NextResponse.json({ data: await getCompanySettings(guard.actor.companyId), success: true });
  });
}

export async function PATCH(request: Request) {
  return withApiHandler(async () => {
    const guard = await requireCompanyAdmin("settings:update");
    if ("error" in guard) return guard.error;
    const input = companySettingsSchema.parse(await readJsonBody(request));
    const data = await updateCompanySettings({ companyId: guard.actor.companyId, userId: guard.actor.user.id }, input);
    return NextResponse.json({ data, success: true });
  });
}
