import { NewOrderContent } from "@/features/back-office/new-order-content";

export default function DashboardNewOrderPage() {
  return <NewOrderContent backHref="/dashboard/orders" backLabel="Retour aux commandes" ordersHref="/dashboard/orders" />;
}
