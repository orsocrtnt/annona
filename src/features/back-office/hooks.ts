"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { backOfficeApi } from "./api";
import type { CompanySupportTicket } from "./types";

export function useCompanySupportTickets() {
  return useQuery({
    queryKey: ["company", "support"],
    queryFn: backOfficeApi.getSupportTickets,
    staleTime: 10_000,
    refetchInterval: 15_000,
  });
}

/** RETOURS-3 : la clé commence par celle de la liste, donc une réponse ou un changement de statut la rafraîchit. */
export function useCompanySupportSummary(enabled: boolean) {
  return useQuery({
    queryKey: ["company", "support", "summary"],
    queryFn: backOfficeApi.getSupportSummary,
    enabled,
    staleTime: 30_000,
    refetchInterval: enabled ? 60_000 : false,
  });
}

export function useAddStaffSupportMessage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ ticketId, body }: { ticketId: string; body: string }) =>
      backOfficeApi.addSupportMessage(ticketId, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["company", "support"] }),
  });
}

export function useUpdateStaffSupportStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      ticketId,
      status,
    }: {
      ticketId: string;
      status: CompanySupportTicket["status"];
    }) => backOfficeApi.updateSupportStatus(ticketId, status),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["company", "support"] }),
  });
}
