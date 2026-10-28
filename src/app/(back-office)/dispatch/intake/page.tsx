import { OrderIntakeContent } from "@/features/back-office/order-intake/order-intake-content";

/** Espace dispatch : pas de lien vers le détail de commande, réservé à /dashboard. */
export default function DispatchOrderIntakePage() {
  return <OrderIntakeContent backHref="/dispatch" backLabel="Centre de dispatch" ordersHref={null} />;
}
