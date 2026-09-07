import { NextResponse } from "next/server";
import { getCompanyId, requireStaffRole } from "@/lib/api/auth-guard";
import { withApiHandler } from "@/lib/api/route-handler";
import { getCompanyAnalytics, type AnalyticsPeriodDays } from "@/domains/analytics/analytics.service";

export async function GET(request: Request) {
  return withApiHandler(async () => {
    const auth = await requireStaffRole("analytics:read");
    if ("error" in auth) return auth.error;

    const companyId = getCompanyId(auth.context);
    if (!companyId) {
      return NextResponse.json({ error: "Entreprise non associée" }, { status: 400 });
    }

    const daysParam = new URL(request.url).searchParams.get("days");
    const periodDays: AnalyticsPeriodDays = daysParam === "7" ? 7 : 30;
    const analytics = await getCompanyAnalytics(companyId, periodDays);
    return NextResponse.json({ data: analytics, success: true });
  });
}
