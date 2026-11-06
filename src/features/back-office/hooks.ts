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
