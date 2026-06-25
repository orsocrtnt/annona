import { redirect } from "next/navigation";
import { getServerAuth } from "@/lib/api/server-auth";
import { getCompanyOrders } from "@/domains/order/order.service";
import { CompanyOrdersContent } from "@/features/back-office/company-orders-content";
import type { CompanyOrder } from "@/features/back-office/types";
import { serialize } from "@/lib/serialize";

export default async function CompanyOrdersPage() {
  const auth = await getServerAuth("orders:read");
  if (!auth) redirect("/login");

  const companyId = auth.user.companyId;
  if (!companyId) redirect("/login");

  const orders = await getCompanyOrders(companyId);
  return <CompanyOrdersContent initialOrders={serialize(orders) as unknown as CompanyOrder[]} />;
}
