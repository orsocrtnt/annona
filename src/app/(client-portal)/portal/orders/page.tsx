import { Suspense } from "react";
import { PageSkeleton } from "@/components/ui/page-skeleton";
import { OrdersList } from "@/features/ordering/orders-list";

export default function ClientOrdersPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <OrdersList />
    </Suspense>
  );
}
