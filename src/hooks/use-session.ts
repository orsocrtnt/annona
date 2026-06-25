"use client";

import { useQuery } from "@tanstack/react-query";
import { useAuthStore } from "@/stores/auth.store";
import { useEffect } from "react";

async function fetchSession() {
  const res = await fetch("/api/auth/session");
  if (!res.ok) throw new Error("Session fetch failed");
  return res.json();
}

export function useSession() {
  const { setUser, setPermissions, setDemo, setLoading } = useAuthStore();

  const query = useQuery({
    queryKey: ["session"],
    queryFn: fetchSession,
    retry: false,
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });

  useEffect(() => {
    if (query.isLoading) return;

    if (query.data) {
      setUser(query.data.user ?? null);
      setPermissions(query.data.permissions ?? []);
      setDemo(query.data.demo ?? null);
    } else if (query.isError) {
      setUser(null);
      setPermissions([]);
      setDemo(null);
    }
    setLoading(false);
  }, [query.data, query.isLoading, query.isError, setUser, setPermissions, setDemo, setLoading]);

  return query;
}
