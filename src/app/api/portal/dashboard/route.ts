import { NextResponse } from "next/server";
import { requireClientRole } from "@/lib/api/auth-guard";
import { withApiHandler } from "@/lib/api/route-handler";
import { getClientOrders, getClientOrderStats } from "@/domains/order/order.service";
import { getClientDeliveries } from "@/domains/delivery/delivery.service";

export async function GET() {
  return withApiHandler(async () => {
    const auth = await requireClientRole();
    if ("error" in auth) return auth.error;

    const customerId = auth.context.user.id;

    const [stats, orders, deliveries] = await Promise.all([
      getClientOrderStats(customerId),
      getClientOrders(customerId),
      getClientDeliveries(customerId),
    ]);

    return NextResponse.json({
      data: {
        activeOrders: stats.activeOrders,
        inDelivery: stats.inDelivery,
        deliveredThisMonth: stats.deliveredThisMonth,
        nextDeliveryEta: stats.nextDeliveryEta,
        orderCount: orders.length,
        recentDeliveries: deliveries.slice(0, 3).map((d) => ({
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
