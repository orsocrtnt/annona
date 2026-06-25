"use client";

import { useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { prefetchRouteQueries } from "@/lib/navigation/nav-query-prefetch";

export function useNavQueryPrefetch(href: string) {
  const queryClient = useQueryClient();

  const prefetch = useCallback(() => {
    prefetchRouteQueries(queryClient, href);
  }, [queryClient, href]);

  return { onMouseEnter: prefetch, onFocus: prefetch };
}
