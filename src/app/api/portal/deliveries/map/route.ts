import { getCompanyLocationSettings } from "@/domains/company/location-settings.service";
import { NextResponse } from "next/server";
import { requireClientRole } from "@/lib/api/auth-guard";
import { withApiHandler } from "@/lib/api/route-handler";
import { getClientDeliveriesMap } from "@/domains/delivery/dispatch-map.service";
import { assertSaasFeature } from "@/domains/saas/saas.service";
import { advanceDemoDriverPositions } from "@/domains/demo/demo-live-positions.service";

export async function GET() {
  return withApiHandler(async () => {
    const auth = await requireClientRole();
    if ("error" in auth) return auth.error;
    const companyId = auth.context.user.companyId;
    if (!companyId) {
      return NextResponse.json({ error: "Entreprise non associée" }, { status: 403 });
    }

    try {
      await assertSaasFeature(companyId, "client_gps");
      // Démo : comme sur la carte du dispatch, les positions simulées avancent à chaque lecture
      // (sinon elles passent « périmées » au-delà du seuil). Sans effet hors démo.
      await advanceDemoDriverPositions(companyId).catch((error) => console.warn("[demo-positions]", error));
      const settings = await getCompanyLocationSettings(companyId);
      const data = await getClientDeliveriesMap(auth.context.user.id, companyId, settings.onlineThresholdSeconds);
      return NextResponse.json({ data, success: true });
    } catch (error) {
      if (error instanceof Error && error.message === "SAAS_FEATURE_NOT_AVAILABLE") {
        return NextResponse.json({ error: "La carte GPS client n’est pas incluse dans cette offre." }, { status: 403 });
      }
      console.error("GET /api/portal/deliveries/map failed:", error);
      return NextResponse.json(
        { error: "Impossible de charger la carte des livraisons" },
        { status: 500 }
      );
    }
  });
}
