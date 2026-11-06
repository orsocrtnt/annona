"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { portalApi } from "./api";
import type { CreateSupportTicketInput } from "@/lib/validations/support";
import type { ClientSettingsInput } from "@/lib/validations/settings";
import { QUERY_STALE_MS } from "@/lib/query/defaults";

export function usePortalSettings() {
  return useQuery({
    queryKey: ["portal", "settings"],
    queryFn: portalApi.getSettings,
    retry: 2,
  });
}

export function useUpdatePortalSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: ClientSettingsInput) => portalApi.updateSettings(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["portal", "settings"] }),
  });
}

export function usePortalNotifications() {
  return useQuery({
    queryKey: ["portal", "notifications"],
    queryFn: portalApi.getNotifications,
    refetchInterval: 60_000,
  });
}

export function useMarkNotificationsRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (ids?: string[]) => portalApi.markNotificationsRead(ids),
    onSuccess: (data) => qc.setQueryData(["portal", "notifications"], data),
  });
}

export function usePortalSupportTickets() {
  return useQuery({
    queryKey: ["portal", "support"],
    queryFn: portalApi.getSupportTickets,
    staleTime: QUERY_STALE_MS,
  });
}

export function usePortalSupportTicket(id: string) {
  return useQuery({
    queryKey: ["portal", "support", id],
    queryFn: () => portalApi.getSupportTicket(id),
    enabled: Boolean(id),
    refetchInterval: 15_000,
  });
}

export function useAddPortalSupportMessage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ ticketId, body }: { ticketId: string; body: string }) =>
      portalApi.addSupportMessage(ticketId, body),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ["portal", "support"] });
      qc.invalidateQueries({ queryKey: ["portal", "support", variables.ticketId] });
    },
  });
}

export function usePortalSupportContacts(orderId?: string) {
  return useQuery({
    queryKey: ["portal", "support", "contacts", orderId],
    queryFn: () => portalApi.getSupportContacts(orderId),
  });
}

export function useCreateSupportTicket() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateSupportTicketInput) => portalApi.createSupportTicket(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["portal", "support"] }),
  });
}
