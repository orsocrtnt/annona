import { NextResponse } from "next/server";
import { getCompanyId, requireRole, requireStaffRole } from "@/lib/api/auth-guard";
import { getCompanyLocationSettings } from "@/domains/company/location-settings.service";
import { getDispatchMapDeliveries } from "@/domains/delivery/dispatch-map.service";
import { assertSaasFeature } from "@/domains/saas/saas.service";
import { advanceDemoDriverPositions } from "@/domains/demo/demo-live-positions.service";

export async function GET() {
  const auth = await requireStaffRole("deliveries:read");
  if ("error" in auth) return auth.error;
  const denied = requireRole(auth.context, ["COMPANY_ADMIN", "MINI_ADMIN", "DISPATCHER"]);
  if (denied) return denied;

  const companyId = getCompanyId(auth.context);
  if (!companyId) {
    return NextResponse.json({ error: "Entreprise non associée" }, { status: 400 });
  }

  try {
    await assertSaasFeature(companyId, "admin_gps");
    // Démo : positions simulées des livreurs en mission (sans effet hors démo).
    await advanceDemoDriverPositions(companyId).catch((error) => console.warn("[demo-positions]", error));
    const locationSettings = await getCompanyLocationSettings(companyId);
    const data = await getDispatchMapDeliveries(
      companyId,
      locationSettings.onlineThresholdSeconds
    );
    return NextResponse.json({ data, success: true });
  } catch (error) {
    if (error instanceof Error && error.message === "SAAS_FEATURE_NOT_AVAILABLE") {
      return NextResponse.json({ error: "La carte GPS administrateur n’est pas incluse dans cette offre." }, { status: 403 });
    }
    console.error("GET /api/dispatch/map failed:", error);
    return NextResponse.json(
      { error: "Impossible de charger la carte des livraisons" },
      { status: 500 }
    );
  }
}
