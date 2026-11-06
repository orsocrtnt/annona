import { Suspense } from "react";
import { PageSkeleton } from "@/components/ui/page-skeleton";
import { OrderCatalog } from "@/features/ordering/order-catalog";

export default function ClientOrderPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <OrderCatalog />
    </Suspense>
  );
}
