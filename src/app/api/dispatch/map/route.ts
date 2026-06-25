import { NextResponse } from "next/server";
import { getCompanyId, requireStaffRole } from "@/lib/api/auth-guard";
import { getCompanyLocationSettings } from "@/domains/company/location-settings.service";
import { getDispatchMapDeliveries } from "@/domains/delivery/dispatch-map.service";

export async function GET() {
  const auth = await requireStaffRole("deliveries:read");
  if ("error" in auth) return auth.error;

  const companyId = getCompanyId(auth.context);
  if (!companyId) {
    return NextResponse.json({ error: "Entreprise non associée" }, { status: 400 });
  }

  try {
    const locationSettings = await getCompanyLocationSettings(companyId);
    const data = await getDispatchMapDeliveries(
      companyId,
      locationSettings.onlineThresholdSeconds
    );
    return NextResponse.json({ data, success: true });
  } catch (error) {
    console.error("GET /api/dispatch/map failed:", error);
    return NextResponse.json(
      { error: "Impossible de charger la carte des livraisons" },
      { status: 500 }
    );
  }
}
