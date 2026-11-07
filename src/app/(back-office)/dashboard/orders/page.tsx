import { Suspense } from "react";
import { PageSkeleton } from "@/components/ui/page-skeleton";
import { AdminOrdersContent } from "@/features/orders/admin-orders-content";

/** LOCK-1 — commandes du jour (ADM-04) ; correction après l'heure limite journalisée (ADM-05, RG-10). */
export default function OrdersPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <AdminOrdersContent />
    </Suspense>
  );
}
