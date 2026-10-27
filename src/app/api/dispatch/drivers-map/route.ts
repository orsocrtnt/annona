import { NextResponse } from "next/server";
import { getCompanyId, requireRole, requireStaffRole } from "@/lib/api/auth-guard";
import { getDispatchDriversMap } from "@/domains/delivery/dispatch-map.service";
import { assertSaasFeature } from "@/domains/saas/saas.service";

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
    const data = await getDispatchDriversMap(companyId);
    return NextResponse.json({ data, success: true });
  } catch (error) {
    if (error instanceof Error && error.message === "SAAS_FEATURE_NOT_AVAILABLE") {
      return NextResponse.json({ error: "La carte GPS administrateur n’est pas incluse dans cette offre." }, { status: 403 });
    }
    console.error("GET /api/dispatch/drivers-map failed:", error);
    return NextResponse.json(
      { error: "Impossible de charger la carte des chauffeurs" },
      { status: 500 }
    );
  }
}
