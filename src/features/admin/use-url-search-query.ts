"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";

/**
 * ADMIN-ESPACE lot 3 : reprend `?q=` de l'adresse dans la recherche d'une liste plateforme
 * (liens de la recherche globale et de la fiche entreprise). La page doit être sous `<Suspense>`.
 */
export function useUrlSearchQuery(apply: (q: string) => void) {
  const raw = useSearchParams().get("q");
  useEffect(() => {
    const q = raw?.trim().slice(0, 80);
    if (q) apply(q);
    // `apply` change à chaque rendu : seule l'adresse déclenche la reprise.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [raw]);
}
