import { NextResponse } from "next/server";
import { requireDriverRole } from "@/lib/api/auth-guard";
import { getCompanyLocationSettings } from "@/domains/company/location-settings.service";

export async function GET() {
  const auth = await requireDriverRole();
  if ("error" in auth) return auth.error;

  const companyId = auth.context.user.companyId;
  if (!companyId) {
    return NextResponse.json({ error: "Entreprise non associée" }, { status: 400 });
  }

  const settings = await getCompanyLocationSettings(companyId);
  return NextResponse.json({ data: settings, success: true });
}
