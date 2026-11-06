"use client";

import { useQuery } from "@tanstack/react-query";

export const COMPANY_LOGO_QUERY_KEY = ["company", "logo"] as const;

async function fetchLogoMeta(): Promise<{ hasLogo: boolean }> {
  const response = await fetch("/api/company/logo?meta=1");
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error ?? "Impossible de lire le logo");
  return payload.data;
}

/**
 * Logo de l'entreprise de l'utilisateur connecté (équipe ou client). On ne demande l'image
 * que si elle existe.
 */
export function useCompanyLogo() {
  const meta = useQuery({ queryKey: COMPANY_LOGO_QUERY_KEY, queryFn: fetchLogoMeta, staleTime: 60_000 });
  return { hasLogo: meta.data?.hasLogo === true, src: "/api/company/logo" };
}
