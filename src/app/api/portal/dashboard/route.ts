import { NextResponse } from "next/server";
import { requireClientRole } from "@/lib/api/auth-guard";
import { withApiHandler } from "@/lib/api/route-handler";
import { getClientOrderStats } from "@/domains/order/order.service";
import { getClientDeliveries } from "@/domains/delivery/delivery.service";
import { getClientBillingSummary } from "@/domains/invoice/invoice.service";
import { PORTAL_RECENT_DELIVERIES_TAKE } from "@/lib/query/list-limits";

export async function GET() {
  return withApiHandler(async () => {
    const auth = await requireClientRole();
    if ("error" in auth) return auth.error;

    const customerId = auth.context.user.id;
    const companyId = auth.context.user.companyId;
    if (!companyId) {
      return NextResponse.json({ error: "Entreprise non associée" }, { status: 403 });
    }

    const [stats, deliveries, billing] = await Promise.all([
      getClientOrderStats(customerId, companyId),
      getClientDeliveries(customerId, companyId, { take: PORTAL_RECENT_DELIVERIES_TAKE }),
      getClientBillingSummary(customerId, companyId),
    ]);

    return NextResponse.json({
      data: {
        activeOrders: stats.activeOrders,
        inDelivery: stats.inDelivery,
        deliveredThisMonth: stats.deliveredThisMonth,
        nextDeliveryEta: stats.nextDeliveryEta,
        nextDeliverySlot: stats.nextDeliverySlot,
        orderCount: stats.orderCount,
        billing,
        recentDeliveries: deliveries.map((d) => ({
          id: d.id,
          reference: d.reference,
          status: d.status,
          deliveryCategory: d.deliveryCategory,
          address: d.address,
          city: d.city,
        })),
      },
      success: true,
    });
  });
}
