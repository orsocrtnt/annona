import { NextResponse } from "next/server";
import { getCompanyId, requireStaffRole } from "@/lib/api/auth-guard";
import { withApiHandler } from "@/lib/api/route-handler";
import { getCompanyDeliveries, getDriverDispatchWorkload } from "@/domains/delivery/delivery.service";
import { getCompanyOrderStats } from "@/domains/order/order.service";
import { getCompanyDispatchSettings } from "@/domains/company/dispatch-settings.service";

export async function GET() {
  return withApiHandler(async () => {
    const auth = await requireStaffRole("deliveries:read");
    if ("error" in auth) return auth.error;

    const companyId = getCompanyId(auth.context);
    if (!companyId) {
      return NextResponse.json({ error: "Entreprise non associée" }, { status: 400 });
    }

    const [deliveries, stats, settings, workload] = await Promise.all([
      getCompanyDeliveries(companyId),
      getCompanyOrderStats(companyId),
      getCompanyDispatchSettings(companyId),
      getDriverDispatchWorkload(companyId),
    ]);

    return NextResponse.json({
      data: { deliveries, stats, settings, workload },
      success: true,
    });
  });
}
