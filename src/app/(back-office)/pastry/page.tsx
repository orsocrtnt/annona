import { Suspense } from "react";
import { PageSkeleton } from "@/components/ui/page-skeleton";
import { ProductionContent } from "@/features/production/production-content";

/**
 * Lot 2, demande 2 — espace pâtissier : total à produire de la pâtisserie du jour choisi (aucun pain).
 * Les envois aux boutiques (demande 5) et les commandes de gâteaux des particuliers (demande 9) s'y
 * ajouteront ; la création des pâtisseries arrive avec la demande 3.
 */
export default function PastryPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <ProductionContent readOnly title="Pâtisserie" />
    </Suspense>
  );
}
