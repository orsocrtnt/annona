import { NextResponse } from "next/server";
import { getCompanyId, requireRole, requireStaffRole } from "@/lib/api/auth-guard";
import { withApiHandler } from "@/lib/api/route-handler";
import { getCompanyDashboardStats } from "@/domains/dashboard/dashboard.service";

export async function GET() {
  return withApiHandler(async () => {
    const auth = await requireStaffRole("orders:read");
    if ("error" in auth) return auth.error;
    const denied = requireRole(auth.context, ["COMPANY_ADMIN", "MINI_ADMIN"]);
    if (denied) return denied;

    const companyId = getCompanyId(auth.context);
    if (!companyId) {
      return NextResponse.json({ error: "Entreprise non associée" }, { status: 400 });
    }

    const dashboard = await getCompanyDashboardStats(companyId);
    return NextResponse.json({ data: dashboard, success: true });
  });
}
