"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { UpdateOrderStatusInput } from "@/lib/validations/order";
import { backOfficeApi } from "./api";
import type { CompanyClient, CompanyOrder } from "./types";
import { QUERY_STALE_MS } from "@/lib/query/defaults";

export function useCompanyDashboard() {
  return useQuery({
    queryKey: ["company", "dashboard"],
    queryFn: backOfficeApi.getDashboard,
    staleTime: QUERY_STALE_MS,
  });
}

export function useCompanyOrders(initialData?: CompanyOrder[]) {
  return useQuery({
    queryKey: ["company", "orders"],
    queryFn: backOfficeApi.getOrders,
    initialData,
    staleTime: QUERY_STALE_MS,
  });
}

export function useCompanyOrder(id: string) {
  return useQuery({
    queryKey: ["company", "orders", id],
    queryFn: () => backOfficeApi.getOrder(id),
    enabled: !!id,
  });
}

export function useDispatchOverview() {
  return useQuery({
    queryKey: ["company", "dispatch", "overview"],
    queryFn: backOfficeApi.getDispatchOverview,
    staleTime: QUERY_STALE_MS,
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
