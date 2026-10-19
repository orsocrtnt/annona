import { getCompanyLocationSettings } from "@/domains/company/location-settings.service";
import { NextResponse } from "next/server";
import { requireClientRole } from "@/lib/api/auth-guard";
import { withApiHandler } from "@/lib/api/route-handler";
import { getClientDeliveriesMap } from "@/domains/delivery/dispatch-map.service";

export async function GET() {
  return withApiHandler(async () => {
    const auth = await requireClientRole();
    if ("error" in auth) return auth.error;
    const companyId = auth.context.user.companyId;
    if (!companyId) {
      return NextResponse.json({ error: "Entreprise non associée" }, { status: 403 });
    }

    try {
      const settings = await getCompanyLocationSettings(companyId);
      const data = await getClientDeliveriesMap(auth.context.user.id, companyId, settings.onlineThresholdSeconds);
      return NextResponse.json({ data, success: true });
    } catch (error) {
      console.error("GET /api/portal/deliveries/map failed:", error);
      return NextResponse.json(
        { error: "Impossible de charger la carte des livraisons" },
        { status: 500 }
      );
    }
  });
}
