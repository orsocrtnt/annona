import { redirect } from "next/navigation";
import { requireServerRole } from "@/lib/api/server-auth";
import { getClientOrders } from "@/domains/order/order.service";
import { ClientOrdersHistoryContent } from "@/features/client-portal/client-orders-history-content";
import type { PortalOrder } from "@/features/client-portal/types";
import { serialize } from "@/lib/serialize";

export default async function OrderHistoryPage() {
  const auth = await requireServerRole("CLIENT");
  if (!auth) redirect("/login/client");

  const orders = await getClientOrders(auth.user.id, { history: true });
  return <ClientOrdersHistoryContent initialOrders={serialize(orders) as unknown as PortalOrder[]} />;
}
