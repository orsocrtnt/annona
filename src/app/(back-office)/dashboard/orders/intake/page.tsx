import { OrderIntakeContent } from "@/features/back-office/order-intake/order-intake-content";

export default function DashboardOrderIntakePage() {
  return <OrderIntakeContent backHref="/dashboard/orders" backLabel="Commandes" ordersHref="/dashboard/orders" />;
}
