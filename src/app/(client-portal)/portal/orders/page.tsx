import { redirect } from "next/navigation";
import { requireServerRole } from "@/lib/api/server-auth";
import { getClientOrders } from "@/domains/order/order.service";
import { ClientOrdersContent } from "@/features/client-portal/client-orders-content";
import type { PortalOrder } from "@/features/client-portal/types";
import { serialize } from "@/lib/serialize";

export default async function ClientOrdersPage() {
  const auth = await requireServerRole("CLIENT");
  if (!auth) redirect("/login/client");

  const orders = await getClientOrders(auth.user.id);
  return <ClientOrdersContent initialOrders={serialize(orders) as unknown as PortalOrder[]} />;
}
