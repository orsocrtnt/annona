"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { UpdateOrderStatusInput } from "@/lib/validations/order";
import { backOfficeApi } from "./api";
import type { CompanyClient, CompanyOrder, CompanySupportTicket } from "./types";
import { QUERY_STALE_MS } from "@/lib/query/defaults";
import type { OrderHistoryPage, OrderHistoryQuery } from "@/lib/query/order-history";

export function useCompanyDashboard() {
  return useQuery({
    queryKey: ["company", "dashboard"],
    queryFn: backOfficeApi.getDashboard,
    staleTime: QUERY_STALE_MS,
    refetchInterval: QUERY_STALE_MS,
  });
}
export function useCompanyAnalytics(days: 7 | 30) {
  return useQuery({
    queryKey: ["company", "analytics", days],
    queryFn: () => backOfficeApi.getAnalytics(days),
    staleTime: QUERY_STALE_MS,
  });
}

export function useCompanyOrders(
  query: OrderHistoryQuery,
  initialData?: OrderHistoryPage<CompanyOrder>
) {
  return useQuery({
    queryKey: ["company", "orders", query],
    queryFn: () => backOfficeApi.getOrders(query),
    initialData,
    staleTime: QUERY_STALE_MS,
    refetchInterval: QUERY_STALE_MS,
    placeholderData: (previous) => previous,
  });
}

export function useCompanyOrder(id: string) {
  return useQuery({
    queryKey: ["company", "orders", id],
    queryFn: () => backOfficeApi.getOrder(id),
    enabled: !!id,
  });
}

export function useCompanyDelivery(id: string) {
  return useQuery({
    queryKey: ["company", "deliveries", id],
    queryFn: () => backOfficeApi.getDelivery(id),
    enabled: !!id,
    // Livraison absente, d'une autre entreprise (404) ou rôle sans droit (403) : pas de relance.
    retry: (failures, error) => !["Livraison introuvable", "Accès refusé"].includes(error.message) && failures < 3,
  });
}

export function useDispatchOverview(deliveryId?: string | null) {
  return useQuery({
    queryKey: ["company", "dispatch", "overview", deliveryId ?? null],
    queryFn: () => backOfficeApi.getDispatchOverview(deliveryId),
    staleTime: QUERY_STALE_MS,
    refetchInterval: QUERY_STALE_MS,
  });
}

export function useCompanyOrderStats() {
  return useQuery({ queryKey: ["company", "orders", "stats"], queryFn: backOfficeApi.getOrderStats });
}

export function useCompanyDeliveries(unassignedOnly = false) {
  return useQuery({
    queryKey: ["company", "deliveries", unassignedOnly ? "unassigned" : "all"],
    queryFn: () => backOfficeApi.getDeliveries(unassignedOnly),
    staleTime: QUERY_STALE_MS,
  });
}

export function useCompanyDrivers() {
  return useQuery({
    queryKey: ["company", "drivers"],
    queryFn: backOfficeApi.getDrivers,
    staleTime: QUERY_STALE_MS,
  });
}

export function useDriverDispatchWorkload() {
  return useQuery({
    queryKey: ["company", "dispatch", "drivers-workload"],
    queryFn: backOfficeApi.getDriverDispatchWorkload,
  });
}

export function useUpdateOrderStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ orderId, data }: { orderId: string; data: UpdateOrderStatusInput }) =>
      backOfficeApi.updateOrderStatus(orderId, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["company"] });
    },
  });
}

export function useDeleteOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (orderId: string) => backOfficeApi.deleteOrder(orderId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["company"] });
    },
  });
}

export function useAssignDelivery() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      deliveryId,
      driverId,
      force = false,
    }: {
      deliveryId: string;
      driverId: string;
      force?: boolean;
    }) => backOfficeApi.assignDelivery(deliveryId, driverId, force),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["company"] });
    },
  });
}

/** DISPATCH-4 : 3 meilleurs livreurs ; pas de relance automatique sur refus (option, rôle). */
export function useDispatchSuggestions(deliveryId: string | null, enabled = true) {
  return useQuery({
    queryKey: ["company", "dispatch", "suggestions", deliveryId],
    queryFn: () => backOfficeApi.getDispatchSuggestions(deliveryId!),
    enabled: Boolean(deliveryId) && enabled,
    staleTime: QUERY_STALE_MS,
    retry: false,
  });
}

export function useAssignFromSuggestion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ deliveryId, driverId }: { deliveryId: string; driverId: string }) =>
      backOfficeApi.assignFromSuggestion(deliveryId, driverId),
    // Succès comme conflit : la file et les suggestions sont relues.
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["company"] });
    },
  });
}

export function useUnassignDelivery() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (deliveryId: string) =>
      backOfficeApi.updateDelivery(deliveryId, { unassignDriver: true }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["company"] });
    },
  });
}

export function useUpdateDelivery() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      deliveryId,
      data,
    }: {
      deliveryId: string;
      data: Parameters<typeof backOfficeApi.updateDelivery>[1];
    }) => backOfficeApi.updateDelivery(deliveryId, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["company"] });
    },
  });
}

export function useCompanyClients(initialData?: CompanyClient[]) {
  return useQuery({
    queryKey: ["company", "clients"],
    queryFn: backOfficeApi.getClients,
    initialData,
    staleTime: QUERY_STALE_MS,
  });
}

export function useCompanyClient(id: string) {
  return useQuery({
    queryKey: ["company", "clients", id],
    queryFn: () => backOfficeApi.getClient(id),
    enabled: !!id,
  });
}

export function useCompanyDriver(id: string) {
  return useQuery({
    queryKey: ["company", "drivers", id],
    queryFn: () => backOfficeApi.getDriver(id),
    enabled: !!id,
  });
}
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
