"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { prefetchRouteQueries } from "@/lib/navigation/nav-query-prefetch";

/** Prefetch RSC + données React Query au survol / focus d’un lien de nav. */
export function useNavQueryPrefetch(href: string) {
  const router = useRouter();
  const queryClient = useQueryClient();

  const prefetch = useCallback(() => {
    router.prefetch(href);
    prefetchRouteQueries(queryClient, href);
  }, [queryClient, href, router]);

  return { onMouseEnter: prefetch, onFocus: prefetch };
}
