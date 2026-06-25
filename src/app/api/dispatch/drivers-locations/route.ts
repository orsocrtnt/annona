import { NextResponse } from "next/server";
import { getCompanyId, requireStaffRole } from "@/lib/api/auth-guard";
import { getCompanyLocationSettings } from "@/domains/company/location-settings.service";
import { getCompanyDriverLocations } from "@/domains/driver/driver-location.service";

export async function GET() {
  const auth = await requireStaffRole("deliveries:read");
  if ("error" in auth) return auth.error;

  const companyId = getCompanyId(auth.context);
  if (!companyId) {
    return NextResponse.json({ error: "Entreprise non associée" }, { status: 400 });
  }

  try {
    const locationSettings = await getCompanyLocationSettings(companyId);
    const drivers = await getCompanyDriverLocations(
      companyId,
      locationSettings.onlineThresholdSeconds
    );
    return NextResponse.json({ data: drivers, success: true });
  } catch (error) {
    console.error("GET /api/dispatch/drivers-locations failed:", error);
    return NextResponse.json(
      { error: "Impossible de charger les positions" },
      { status: 500 }
    );
  }
}
