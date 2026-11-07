"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { adminOrdersApi } from "./api";
import type { AdminCorrectOrderInput } from "@/lib/validations/order";

export const ADMIN_ORDER_KEYS = {
  all: ["admin-orders"] as const,
  day: (date: string, merchantId: string | null, roundId: string | null) => ["admin-orders", "day", date, merchantId, roundId] as const,
  order: (id: string) => ["admin-orders", "detail", id] as const,
};

export function useAdminOrderDay(date: string, merchantId: string | null, roundId: string | null) {
  return useQuery({
    queryKey: ADMIN_ORDER_KEYS.day(date, merchantId, roundId),
    queryFn: () => adminOrdersApi.day(date, { merchantId, roundId }),
    placeholderData: (previous) => previous,
  });
}

export function useAdminOrder(id: string) {
  return useQuery({ queryKey: ADMIN_ORDER_KEYS.order(id), queryFn: () => adminOrdersApi.order(id) });
}

export function useCorrectOrder(id: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: AdminCorrectOrderInput) => adminOrdersApi.correct(id, input),
    onSuccess: (data) => {
      client.setQueryData(ADMIN_ORDER_KEYS.order(id), data);
      void client.invalidateQueries({ queryKey: [...ADMIN_ORDER_KEYS.all, "day"] });
    },
  });
}

export function useCancelOrder(id: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (note: string | null) => adminOrdersApi.cancel(id, note),
    onSuccess: (data) => {
      client.setQueryData(ADMIN_ORDER_KEYS.order(id), data);
      void client.invalidateQueries({ queryKey: [...ADMIN_ORDER_KEYS.all, "day"] });
    },
  });
}
