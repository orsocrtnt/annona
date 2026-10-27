import { NextResponse } from "next/server";
import { getCompanyId, requireRole, requireStaffRole } from "@/lib/api/auth-guard";
import { withApiHandler } from "@/lib/api/route-handler";
import { getCompanyAnalytics, type AnalyticsPeriodDays } from "@/domains/analytics/analytics.service";
import { assertSaasFeature } from "@/domains/saas/saas.service";

export async function GET(request: Request) {
  return withApiHandler(async () => {
    const auth = await requireStaffRole("analytics:read");
    if ("error" in auth) return auth.error;
    const denied = requireRole(auth.context, ["COMPANY_ADMIN", "MINI_ADMIN"]);
    if (denied) return denied;

    const companyId = getCompanyId(auth.context);
    if (!companyId) {
      return NextResponse.json({ error: "Entreprise non associée" }, { status: 400 });
    }

    try {
      await assertSaasFeature(companyId, "advanced_analytics");
    } catch (error) {
      if (error instanceof Error && error.message === "SAAS_FEATURE_NOT_AVAILABLE") {
        return NextResponse.json({ error: "Les analytics avancés ne sont pas inclus dans cette offre." }, { status: 403 });
      }
      throw error;
    }

    const daysParam = new URL(request.url).searchParams.get("days");
    const periodDays: AnalyticsPeriodDays = daysParam === "7" ? 7 : 30;
    const analytics = await getCompanyAnalytics(companyId, periodDays);
    return NextResponse.json({ data: analytics, success: true });
  });
}
