import { Suspense } from "react";
import { PageSkeleton } from "@/components/ui/page-skeleton";
import { RecurringContent } from "@/features/ordering/recurring-content";

export default function ClientRecurringPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <RecurringContent />
    </Suspense>
  );
}
