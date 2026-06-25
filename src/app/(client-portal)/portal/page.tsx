import { redirect } from "next/navigation";
import { requireServerRole } from "@/lib/api/server-auth";
import { getClientOrders, getClientOrderStats } from "@/domains/order/order.service";
import { getClientDeliveries } from "@/domains/delivery/delivery.service";
import { getPortalDashboardLayout } from "@/domains/client-portal/portal-dashboard-settings.service";
import { PortalDashboardContent } from "@/features/client-portal/portal-dashboard-content";
import type { PortalDashboardStats } from "@/features/client-portal/types";
import { serialize } from "@/lib/serialize";

export default async function ClientDashboardPage() {
  const auth = await requireServerRole("CLIENT");
  if (!auth) redirect("/login/client");

  const customerId = auth.user.id;

  const [stats, orders, deliveries, layout] = await Promise.all([
    getClientOrderStats(customerId),
    getClientOrders(customerId),
    getClientDeliveries(customerId),
    getPortalDashboardLayout(customerId),
  ]);

  const dashboardData = serialize({
    activeOrders: stats.activeOrders,
    inDelivery: stats.inDelivery,
    deliveredThisMonth: stats.deliveredThisMonth,
    nextDeliveryEta: stats.nextDeliveryEta?.toISOString() ?? null,
    orderCount: orders.length,
    recentDeliveries: deliveries.slice(0, 3).map((d) => ({
      id: d.id,
      reference: d.reference,
      status: d.status,
      deliveryCategory: d.deliveryCategory,
      address: d.address,
      city: d.city,
    })),
  }) as PortalDashboardStats;

  return (
    <PortalDashboardContent stats={dashboardData} initialLayout={serialize(layout)} />
  );
}
