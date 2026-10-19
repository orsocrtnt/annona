"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { prefetchRouteQueries } from "@/lib/navigation/nav-query-prefetch";

const SKIP_DATA_PREFETCH = new Set(["/dispatch/map", "/dispatch/drivers"]);

/** Prefetch RSC + données React Query au survol, focus et avant le clic. */
export function useNavQueryPrefetch(href: string) {
  const router = useRouter();
  const queryClient = useQueryClient();

  const prefetch = useCallback(() => {
    router.prefetch(href);
    if (!SKIP_DATA_PREFETCH.has(href)) {
      prefetchRouteQueries(queryClient, href);
    }
  }, [queryClient, href, router]);

  return {
    // Le survol/focus exprime une intention ; éviter le fan-out automatique du menu.
    prefetch: false as const,
    onMouseEnter: prefetch,
    onFocus: prefetch,
    onPointerDown: prefetch,
  };
}
