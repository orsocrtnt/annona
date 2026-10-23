"use client";

import { useQuery } from "@tanstack/react-query";
import { useAuthStore } from "@/stores/auth.store";
import { useEffect } from "react";
import { QUERY_GC_MS, QUERY_STALE_MS } from "@/lib/query/defaults";

async function fetchSession() {
  const res = await fetch("/api/auth/session");
  if (!res.ok) throw new Error("Session fetch failed");
  return res.json();
}

/**
 * Ne rappelle /api/auth/session que si le store n'a pas encore d'utilisateur
 * (évite un 3e getUser après login / entre navigations client).
 */
export function useSession() {
  const user = useAuthStore((s) => s.user);
  const { setUser, setPermissions, setDemo, setSaas, setLoading } = useAuthStore();

  const query = useQuery({
    queryKey: ["session"],
    queryFn: fetchSession,
    enabled: !user,
    retry: false,
    staleTime: QUERY_STALE_MS,
    gcTime: QUERY_GC_MS,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
  });

  useEffect(() => {
    if (user) {
      setLoading(false);
      return;
    }

    if (query.isLoading || query.isFetching) return;

    if (query.data) {
      setSaas(query.data.saas ?? null);
      setPermissions(query.data.permissions ?? []);
      setDemo(query.data.demo ?? null);
      setUser(query.data.user ?? null);
    } else if (query.isError) {
      setUser(null);
      setPermissions([]);
      setDemo(null);
      setSaas(null);
    }
    setLoading(false);
  }, [
    user,
    query.data,
    query.isLoading,
    query.isFetching,
    query.isError,
    setUser,
    setPermissions,
    setDemo,
    setSaas,
    setLoading,
  ]);

  return query;
}
