"use client";

import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { orderingApi } from "./api";
import type { RecurringOrderInput, UpdateRecurringOrderInput } from "@/lib/validations/order";

export const ORDERING_KEYS = {
  catalog: ["portal", "catalog"] as const,
  profile: ["portal", "merchant"] as const,
  orders: ["portal", "orders"] as const,
  list: (scope: "upcoming" | "history") => ["portal", "orders", "list", scope] as const,
  order: (id: string) => ["portal", "orders", "detail", id] as const,
  lookup: (date: string, slotId: string) => ["portal", "orders", "lookup", date, slotId] as const,
  recurring: ["portal", "recurring"] as const,
};

export function usePortalCatalog() {
  return useQuery({ queryKey: ORDERING_KEYS.catalog, queryFn: orderingApi.catalog, staleTime: 30_000 });
}

export function useMerchantProfile() {
  return useQuery({ queryKey: ORDERING_KEYS.profile, queryFn: orderingApi.profile, staleTime: 60_000 });
}

export function useUpcomingOrders() {
  return useQuery({ queryKey: ORDERING_KEYS.list("upcoming"), queryFn: () => orderingApi.orders("upcoming") });
}

export function useOrderHistory() {
  return useInfiniteQuery({
    queryKey: ORDERING_KEYS.list("history"),
    queryFn: ({ pageParam }) => orderingApi.orders("history", pageParam),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.nextBefore,
  });
}

export function usePortalOrder(id: string | null) {
  return useQuery({ queryKey: ORDERING_KEYS.order(id ?? ""), queryFn: () => orderingApi.order(id!), enabled: Boolean(id) });
}

export function useOrderLookup(date: string | null, slotId: string | null) {
  return useQuery({
    queryKey: ORDERING_KEYS.lookup(date ?? "", slotId ?? ""),
    queryFn: () => orderingApi.lookup(date!, slotId!),
    enabled: Boolean(date && slotId),
    staleTime: 10_000,
  });
}

function useInvalidateOrders() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: ORDERING_KEYS.orders });
}

export function useSaveOrder() {
  const invalidate = useInvalidateOrders();
  return useMutation({ mutationFn: orderingApi.save, onSuccess: invalidate });
}

export function useCancelOrder() {
  const invalidate = useInvalidateOrders();
  return useMutation({ mutationFn: orderingApi.cancel, onSuccess: invalidate });
}

export function useReorder() {
  const invalidate = useInvalidateOrders();
  return useMutation({
    mutationFn: ({ id, deliveryDate, slotId }: { id: string; deliveryDate: string; slotId: string }) =>
      orderingApi.reorder(id, { deliveryDate, slotId }),
    onSuccess: invalidate,
  });
}

export function useRecurringOrders() {
  return useQuery({ queryKey: ORDERING_KEYS.recurring, queryFn: orderingApi.recurring });
}

export function useSaveRecurring() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string | null; input: RecurringOrderInput | UpdateRecurringOrderInput }) =>
      id ? orderingApi.updateRecurring(id, input) : orderingApi.createRecurring(input as RecurringOrderInput),
    onSuccess: () => qc.invalidateQueries({ queryKey: ORDERING_KEYS.recurring }),
  });
}

export function useDeleteRecurring() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: orderingApi.deleteRecurring,
    onSuccess: () => qc.invalidateQueries({ queryKey: ORDERING_KEYS.recurring }),
  });
}
