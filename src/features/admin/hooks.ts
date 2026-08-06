"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchAdminOverview } from "./api";
import { QUERY_STALE_MS } from "@/lib/query/defaults";

export function useAdminOverview() {
  return useQuery({
    queryKey: ["admin", "overview"],
    queryFn: fetchAdminOverview,
    staleTime: QUERY_STALE_MS,
  });
}
