import { Suspense } from "react";
import { PageSkeleton } from "@/components/ui/page-skeleton";
import { RoundsContent } from "@/features/rounds/rounds-content";

/** TOUR-1 — tournées d'un jour : ordre, déplacements, livreurs et validation (ADM-06, ADM-07). */
export default function RoundsPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <RoundsContent />
    </Suspense>
  );
}
