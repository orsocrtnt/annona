import { NextResponse } from "next/server";
import { getCompanyId, requireRole, requireStaffRole } from "@/lib/api/auth-guard";
import { withApiHandler } from "@/lib/api/route-handler";
import { getCompanyDeliveries } from "@/domains/delivery/delivery.service";

export async function GET(request: Request) {
  return withApiHandler(async () => {
    const auth = await requireStaffRole("deliveries:read");
    if ("error" in auth) return auth.error;
    const denied = requireRole(auth.context, ["COMPANY_ADMIN", "MINI_ADMIN", "DISPATCHER"]);
    if (denied) return denied;

    const companyId = getCompanyId(auth.context);
    if (!companyId) {
      return NextResponse.json({ error: "Entreprise non associée" }, { status: 400 });
    }

    const { searchParams } = new URL(request.url);
    const unassignedOnly = searchParams.get("unassigned") === "true";

    const deliveries = await getCompanyDeliveries(companyId, { unassignedOnly });
    return NextResponse.json({ data: deliveries, success: true });
  });
}
