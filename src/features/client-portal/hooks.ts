"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { portalApi } from "./api";
import type { CreateClientOrderInput, CreateRecurringOrderInput, UpdateRecurringOrderInput } from "@/lib/validations/order";
import type { CustomerAddressInput } from "@/lib/validations/address";
import type { CreateSupportTicketInput } from "@/lib/validations/support";
import type { ClientSettingsInput } from "@/lib/validations/settings";
import type { CreateClientOrderFormInput } from "@/lib/validations/order";
import type {
  DispatchMapDelivery,
} from "@/domains/delivery/dispatch-map.service";
import { DEFAULT_DRIVER_LOCATION_SETTINGS } from "@/lib/validations/driver-location-settings";
import type { PortalInvoice, PortalOrder } from "./types";
import { QUERY_STALE_MS } from "@/lib/query/defaults";
import type { OrderHistoryPage, OrderHistoryQuery } from "@/lib/query/order-history";

export function usePortalDashboard() {
  return useQuery({
    queryKey: ["portal", "dashboard"],
    queryFn: portalApi.getDashboard,
    staleTime: QUERY_STALE_MS,
    refetchInterval: QUERY_STALE_MS,
  });
}

export function usePortalOrders(
  query: OrderHistoryQuery,
  initialData?: OrderHistoryPage<PortalOrder>
) {
  return useQuery({
    queryKey: ["portal", "orders", query],
    queryFn: () => portalApi.getOrders(query),
    initialData,
    staleTime: QUERY_STALE_MS,
    refetchInterval: QUERY_STALE_MS,
    placeholderData: (previous) => previous,
  });
}

export function usePortalOrder(id: string) {
  return useQuery({
    queryKey: ["portal", "orders", id],
    queryFn: () => portalApi.getOrder(id),
    enabled: !!id,
  });
}

export function useCreateOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ data, idempotencyKey }: {
      data: CreateClientOrderInput;
      idempotencyKey: string;
    }) => portalApi.createOrder(data, idempotencyKey),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["portal"] });
    },
  });
}

export function usePortalDeliveries() {
  return useQuery({
    queryKey: ["portal", "deliveries"],
    queryFn: portalApi.getDeliveries,
    staleTime: QUERY_STALE_MS,
  });
}

export function usePortalDeliveriesMap() {
  const refreshMs = DEFAULT_DRIVER_LOCATION_SETTINGS.adminMapRefreshSeconds * 1000;

  return useQuery({
    queryKey: ["portal", "deliveries", "map"],
    queryFn: () =>
      fetch("/api/portal/deliveries/map")
        .then(async (res) => {
          const json = await res.json();
          if (!res.ok) throw new Error(json.error ?? "Erreur serveur");
          return json.data as { active: DispatchMapDelivery[]; history: DispatchMapDelivery[] };
        }),
    retry: 1,
    refetchInterval: (query) =>
      query.state.status === "error" ? false : refreshMs,
  });
}

export function useDeliveryReorderTemplate(deliveryId: string | null) {
  return useQuery({
    queryKey: ["portal", "deliveries", deliveryId, "reorder"],
    queryFn: () =>
      fetch(`/api/portal/deliveries/${deliveryId}/reorder`)
        .then(async (res) => {
          const json = await res.json();
          if (!res.ok) throw new Error(json.error ?? "Erreur serveur");
          return json.data as {
            deliveryId: string;
            deliveryReference: string;
            formValues: CreateClientOrderFormInput;
          };
        }),
    enabled: !!deliveryId,
  });
}

export function useOrderReorderTemplate(orderId: string | null) {
  return useQuery({
    queryKey: ["portal", "orders", orderId, "reorder"],
    queryFn: () =>
      fetch(`/api/portal/orders/${orderId}/reorder`)
        .then(async (res) => {
          const json = await res.json();
          if (!res.ok) throw new Error(json.error ?? "Erreur serveur");
          return json.data as {
            orderId: string;
            orderReference: string;
            deliveryId: string | null;
            deliveryReference: string;
            formValues: CreateClientOrderFormInput;
          };
        }),
    enabled: !!orderId,
  });
}

export function usePortalDelivery(id: string) {
  return useQuery({
    queryKey: ["portal", "deliveries", id],
    queryFn: () => portalApi.getDelivery(id),
    enabled: !!id,
  });
}

export function usePortalInvoices(initialData?: PortalInvoice[]) {
  return useQuery({
    queryKey: ["portal", "invoices"],
    queryFn: portalApi.getInvoices,
    initialData,
    staleTime: QUERY_STALE_MS,
  });
}

export function usePortalInvoice(id: string) {
  return useQuery({
    queryKey: ["portal", "invoices", id],
    queryFn: () => portalApi.getInvoice(id),
    enabled: !!id,
  });
}

export function usePortalRecurringOrders() {
  return useQuery({
    queryKey: ["portal", "recurring"],
    queryFn: portalApi.getRecurringOrders,
    staleTime: QUERY_STALE_MS,
  });
}

export function useCreateRecurringOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateRecurringOrderInput) => portalApi.createRecurringOrder(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["portal"] }),
  });
}

export function useUpdateRecurringOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateRecurringOrderInput }) =>
      portalApi.updateRecurringOrder(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["portal"] }),
  });
}

export function usePortalAddresses() {
  return useQuery({
    queryKey: ["portal", "addresses"],
    queryFn: portalApi.getAddresses,
    retry: 2,
  });
}

export function useCreateAddress() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CustomerAddressInput) => portalApi.createAddress(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["portal", "addresses"] }),
  });
}

export function useUpdateAddress() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<CustomerAddressInput> }) =>
      portalApi.updateAddress(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["portal", "addresses"] }),
  });
}

export function useDeleteAddress() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => portalApi.deleteAddress(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["portal", "addresses"] }),
  });
}

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

export function usePortalSupportContacts(deliveryId?: string) {
  return useQuery({
    queryKey: ["portal", "support", "contacts", deliveryId],
    queryFn: () => portalApi.getSupportContacts(deliveryId),
  });
}

export function useCreateSupportTicket() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateSupportTicketInput) => portalApi.createSupportTicket(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["portal", "support"] }),
  });
}
