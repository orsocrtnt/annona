import { AdminOrderDetailView } from "@/features/orders/admin-order-detail";

/** LOCK-1 — détail, correction (ADM-05) et historique (RG-10) d'une commande. */
export default async function OrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <AdminOrderDetailView id={id} />;
}
