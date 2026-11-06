"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import {
  fetchAdminCompanies,
  fetchAdminCompany,
  fetchAdminUsers,
  fetchAdminOperationJobs,
  fetchAdminServiceHealth,
  fetchAdminOverview,
  fetchAdminSupportTickets,
  fetchAdminHome,
  fetchAdminHomeBadges,
  fetchAdminSearch,
  type CompanyListFilters,
  type PlatformUserListFilters,
  type OperationJobListFilters,
  type SupportTicketListFilters,
} from "./api";
import { QUERY_STALE_MS } from "@/lib/query/defaults";

export function useAdminUsers(filters: PlatformUserListFilters) {
  return useQuery({
    queryKey: ["admin", "users", filters],
    queryFn: () => fetchAdminUsers(filters),
    staleTime: QUERY_STALE_MS,
  });
}

export function useAdminCompanies(filters: CompanyListFilters, enabled = true) {
  return useQuery({
    queryKey: ["admin", "companies", filters],
    queryFn: () => fetchAdminCompanies(filters),
    enabled,
    staleTime: QUERY_STALE_MS,
  });
}

export function useAdminCompany(id: string) {
  return useQuery({
    queryKey: ["admin", "company", id],
    queryFn: () => fetchAdminCompany(id),
    enabled: id.length > 0,
    staleTime: QUERY_STALE_MS,
  });
}

export function useAdminOverview() {
  return useQuery({
    queryKey: ["admin", "overview"],
    queryFn: fetchAdminOverview,
    staleTime: QUERY_STALE_MS,
  });
}

export function useAdminServiceHealth() {
  return useQuery({
    queryKey: ["admin", "service-health"],
    queryFn: fetchAdminServiceHealth,
    staleTime: QUERY_STALE_MS,
  });
}

export function useAdminOperationJobs(filters: OperationJobListFilters) {
  return useQuery({
    queryKey: ["admin", "operation-jobs", filters],
    queryFn: () => fetchAdminOperationJobs(filters),
    staleTime: QUERY_STALE_MS,
  });
}

export function useAdminSupportTickets(filters: SupportTicketListFilters) {
  return useQuery({
    queryKey: ["admin", "support-tickets", filters],
    queryFn: () => fetchAdminSupportTickets(filters),
    staleTime: QUERY_STALE_MS,
  });
}

/** ADMIN-ESPACE : accueil du super-administrateur. */
export function useAdminHome() {
  return useQuery({
    queryKey: ["admin", "home"],
    queryFn: fetchAdminHome,
    staleTime: QUERY_STALE_MS,
  });
}

/** Pastilles du menu : lecture légère, rafraîchie au plus une fois par minute. */
export function useAdminNavBadges(enabled: boolean) {
  return useQuery({
    queryKey: ["admin", "home-badges"],
    queryFn: fetchAdminHomeBadges,
    enabled,
    staleTime: 60_000,
  });
}

/** Recherche globale du super-administrateur : lancée à partir de 2 caractères, requête annulée si la saisie change. */
export function useAdminSearch(q: string) {
  return useQuery({
    queryKey: ["admin", "search", q],
    queryFn: ({ signal }) => fetchAdminSearch(q, signal),
    enabled: q.length >= 2,
    staleTime: 30_000,
    retry: false,
    placeholderData: keepPreviousData,
  });
}
