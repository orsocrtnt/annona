import { Suspense } from "react";
import { PageSkeleton } from "@/components/ui/page-skeleton";
import { ProductionContent } from "@/features/production/production-content";

/** BOU-1 — espace boulanger : total à produire, bons, tournées, préparé et manquants (BOU-01 à BOU-06). */
export default function BakeryPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <ProductionContent />
    </Suspense>
  );
}
