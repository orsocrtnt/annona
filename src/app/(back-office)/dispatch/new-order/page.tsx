import { NewOrderContent } from "@/features/back-office/new-order-content";

/** Espace dispatch : pas de lien vers le détail de commande, réservé à /dashboard. */
export default function DispatchNewOrderPage() {
  return <NewOrderContent backHref="/dispatch" backLabel="Retour au centre de dispatch" ordersHref={null} />;
}
