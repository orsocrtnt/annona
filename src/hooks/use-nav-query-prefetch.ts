"use client";

import { useCallback, useEffect } from "react";
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
    prefetch: true as const,
    onMouseEnter: prefetch,
    onFocus: prefetch,
    onPointerDown: prefetch,
  };
}

/** Précharge le menu dès que le layout est affiché (idle). */
export function usePrefetchNavHrefs(hrefs: readonly string[]) {
  const router = useRouter();
  const key = hrefs.join("|");

  useEffect(() => {
    const routes = key.split("|").filter(Boolean);
    let cancelled = false;

    const run = () => {
      if (cancelled) return;
      for (const href of routes) {
        router.prefetch(href);
      }
    };

    if (typeof requestIdleCallback === "function") {
      const idleId = requestIdleCallback(run, { timeout: 1200 });
      return () => {
        cancelled = true;
        cancelIdleCallback(idleId);
      };
    }

    const timeoutId = window.setTimeout(run, 200);
    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, [key, router]);
}
