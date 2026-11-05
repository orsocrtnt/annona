"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
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
  fetchAdminHome,
  fetchAdminHomeBadges,
  fetchAdminCampaign,
  fetchAdminCampaigns,
  fetchAdminWaitlist,
  fetchAdminWaitlistFunnel,
  fetchAdminSearch,
  fetchAdminPilots,
  fetchAdminPilot,
  fetchAdminProspectionSheet,
  type PlatformAccessListFilters,
  type WaitlistListFilters,
  type CompanyListFilters,
  type PlatformUserListFilters,
  type IncidentListFilters,
  type OperationJobListFilters,
  type SubscriptionListFilters,
  type SupportTicketListFilters,
} from "./api";
import type { AdminLastVisits } from "@/features/admin/contact-last-visit";
import { QUERY_STALE_MS } from "@/lib/query/defaults";
import type { FunnelPeriod } from "@/domains/growth/waitlist-funnel.service";

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

/** ADMIN-ESPACE : accueil du super-administrateur ; dernières visites lues dans le navigateur (Contact, liste d'attente). */
export function useAdminHome(since: AdminLastVisits | undefined) {
  return useQuery({
    queryKey: ["admin", "home", since?.contact ?? null, since?.waitlist ?? null],
    queryFn: () => fetchAdminHome(since ?? { contact: null, waitlist: null }),
    enabled: since !== undefined,
    staleTime: QUERY_STALE_MS,
  });
}

/** Pastilles du menu : lecture légère, rafraîchie au plus une fois par minute (chaque lecture est journalisée). */
export function useAdminNavBadges(since: AdminLastVisits | undefined, enabled: boolean) {
  return useQuery({
    queryKey: ["admin", "home-badges", since?.contact ?? null, since?.waitlist ?? null],
    queryFn: () => fetchAdminHomeBadges(since ?? { contact: null, waitlist: null }),
    enabled: enabled && since !== undefined,
    staleTime: 60_000,
  });
}

/** ADMIN-ESPACE lot 2 : inscriptions à la liste d'attente. */
export function useAdminWaitlist(filters: WaitlistListFilters) {
  return useQuery({
    queryKey: ["admin", "waitlist", filters],
    queryFn: () => fetchAdminWaitlist(filters),
    staleTime: QUERY_STALE_MS,
    placeholderData: keepPreviousData,
  });
}

/** ADMIN-ESPACE lot 2 : entonnoir visites → clics → inscriptions de /tarifs. */
export function useAdminWaitlistFunnel(days: FunnelPeriod) {
  return useQuery({
    queryKey: ["admin", "waitlist-funnel", days],
    queryFn: () => fetchAdminWaitlistFunnel(days),
    staleTime: QUERY_STALE_MS,
    placeholderData: keepPreviousData,
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

/** ADMIN-ESPACE lot 4 : pilotes accompagnés, par étape. */
export function useAdminPilots() {
  return useQuery({
    queryKey: ["admin", "pilots"],
    queryFn: fetchAdminPilots,
    staleTime: QUERY_STALE_MS,
  });
}

/** ADMIN-ESPACE lot 4 : fiche d'un pilote (notes, courbe 30 jours de l'entreprise liée). */
export function useAdminPilot(id: string) {
  return useQuery({
    queryKey: ["admin", "pilot", id],
    queryFn: () => fetchAdminPilot(id),
    enabled: id.length > 0,
    staleTime: QUERY_STALE_MS,
    retry: (count, error) => !(error instanceof Error && error.message === "Pilote introuvable") && count < 2,
  });
}

/** ADMIN-ESPACE lot 5 : campagnes de prospection et chiffres. */
export function useAdminCampaigns() {
  return useQuery({
    queryKey: ["admin", "campaigns"],
    queryFn: fetchAdminCampaigns,
    staleTime: QUERY_STALE_MS,
    placeholderData: keepPreviousData,
  });
}

export function useAdminCampaign(id: string | null) {
  return useQuery({
    queryKey: ["admin", "campaigns", id],
    queryFn: () => fetchAdminCampaign(id!),
    enabled: Boolean(id),
    staleTime: QUERY_STALE_MS,
  });
}

/** ADMIN-ESPACE lot 5 : chiffres de la Google Sheet de prospection (cache serveur de 5 minutes). */
export function useAdminProspectionSheet() {
  return useQuery({
    queryKey: ["admin", "prospection", "sheet"],
    queryFn: fetchAdminProspectionSheet,
    staleTime: 60_000,
    retry: false,
  });
}
