import { NextResponse } from "next/server";
import { getCompanyId, requireRole, requireStaffRole } from "@/lib/api/auth-guard";
import { withApiHandler } from "@/lib/api/route-handler";
import { getCompanyDeliveries, getDriverDispatchWorkload } from "@/domains/delivery/delivery.service";
import { getCompanyOrderStats } from "@/domains/order/order.service";
import { parseDispatchSettings } from "@/domains/company/dispatch-settings.service";

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

    const raw = (auth.context.user.company?.settings ?? {}) as Record<string, unknown>;
    const settings = parseDispatchSettings(raw.dispatchRules);
    const requestedDeliveryId = new URL(request.url).searchParams.get("delivery")?.trim();
    const includeDeliveryId =
      requestedDeliveryId && requestedDeliveryId.length <= 128
        ? requestedDeliveryId
        : undefined;
    const [deliveries, stats, workload] = await Promise.all([
      getCompanyDeliveries(companyId, { includeDeliveryId }),
      getCompanyOrderStats(companyId),
      getDriverDispatchWorkload(companyId),
    ]);

    return NextResponse.json({
      data: { deliveries, stats, settings, workload },
      success: true,
    });
  });
}
