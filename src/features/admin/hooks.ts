"use client";

import { useQuery } from "@tanstack/react-query";
import {
  fetchAdminAccessEvents,
  fetchAdminCompanies,
  fetchAdminCompany,
  fetchAdminUsers,
  fetchAdminIncidents,
  fetchAdminOperationJobs,
  fetchAdminServiceHealth,
  fetchAdminOverview,
  fetchAdminSaasHealth,
  fetchAdminSubscriptions,
  fetchAdminSupportTickets,
  type PlatformAccessListFilters,
  type CompanyListFilters,
  type PlatformUserListFilters,
  type IncidentListFilters,
  type OperationJobListFilters,
  type SubscriptionListFilters,
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

export function useAdminCompanies(filters: CompanyListFilters) {
  return useQuery({
    queryKey: ["admin", "companies", filters],
    queryFn: () => fetchAdminCompanies(filters),
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

export function useAdminSaasHealth() {
  return useQuery({
    queryKey: ["admin", "saas-health"],
    queryFn: fetchAdminSaasHealth,
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

export function useAdminIncidents(filters: IncidentListFilters) {
  return useQuery({
    queryKey: ["admin", "incidents", filters],
    queryFn: () => fetchAdminIncidents(filters),
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

export function useAdminAccessEvents(filters: PlatformAccessListFilters) {
  return useQuery({
    queryKey: ["admin", "access-events", filters],
    queryFn: () => fetchAdminAccessEvents(filters),
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

export function useAdminSubscriptions(filters: SubscriptionListFilters) {
  return useQuery({
    queryKey: ["admin", "subscriptions", filters],
    queryFn: () => fetchAdminSubscriptions(filters),
    staleTime: QUERY_STALE_MS,
  });
}
