import { NextResponse } from "next/server";
import { requireDriverRole } from "@/lib/api/auth-guard";
import { parseLocationSettings } from "@/domains/company/location-settings.service";

export async function GET() {
  const auth = await requireDriverRole();
  if ("error" in auth) return auth.error;

  const companyId = auth.context.user.companyId;
  if (!companyId) {
    return NextResponse.json({ error: "Entreprise non associée" }, { status: 400 });
  }

  const raw = (auth.context.user.company?.settings ?? {}) as Record<string, unknown>;
  const settings = parseLocationSettings(raw.locationTracking);
  return NextResponse.json({ data: settings, success: true });
}
