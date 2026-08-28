import { NextResponse } from "next/server";
import { requireClientRole } from "@/lib/api/auth-guard";
import { withApiHandler } from "@/lib/api/route-handler";
import { getClientOrderCount, getClientOrderStats } from "@/domains/order/order.service";
import { getClientDeliveries } from "@/domains/delivery/delivery.service";
import { PORTAL_RECENT_DELIVERIES_TAKE } from "@/lib/query/list-limits";

export async function GET() {
  return withApiHandler(async () => {
    const auth = await requireClientRole();
    if ("error" in auth) return auth.error;

    const customerId = auth.context.user.id;

    const [stats, orderCount, deliveries] = await Promise.all([
      getClientOrderStats(customerId),
      getClientOrderCount(customerId),
      getClientDeliveries(customerId, { take: PORTAL_RECENT_DELIVERIES_TAKE }),
    ]);

    return NextResponse.json({
      data: {
        activeOrders: stats.activeOrders,
        inDelivery: stats.inDelivery,
        deliveredThisMonth: stats.deliveredThisMonth,
        nextDeliveryEta: stats.nextDeliveryEta,
        orderCount,
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
