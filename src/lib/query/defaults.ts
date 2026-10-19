/** Revalidation des données opérationnelles ; cache de retour immédiatement visible. */
export const QUERY_STALE_MS = 15_000;
export const QUERY_GC_MS = 20 * 60 * 1000;

export const OPERATIONAL_QUERY_DEFAULTS = {
  staleTime: QUERY_STALE_MS,
  gcTime: QUERY_GC_MS,
  refetchOnWindowFocus: true,
  refetchOnMount: true,
  // React Query suspend déjà les intervalles en arrière-plan.
  refetchIntervalInBackground: false,
} as const;
