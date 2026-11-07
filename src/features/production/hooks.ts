"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { productionApi } from "./api";

export const PRODUCTION_KEYS = {
  day: (date: string) => ["production", date] as const,
};

export function useProductionDay(date: string) {
  return useQuery({
    queryKey: PRODUCTION_KEYS.day(date),
    queryFn: () => productionApi.day(date),
    placeholderData: (previous) => previous,
    // Tablette laissée ouverte à l'heure limite : relit le jour pour basculer du provisoire au définitif.
    refetchInterval: 60_000,
  });
}

export function useSetPrepared(date: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ orderId, prepared }: { orderId: string; prepared: boolean }) => productionApi.prepared(orderId, prepared),
    onSuccess: () => client.invalidateQueries({ queryKey: PRODUCTION_KEYS.day(date) }),
  });
}

export function useReportShortage(date: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ lineId, quantityDelivered }: { lineId: string; quantityDelivered: number }) => productionApi.shortage(lineId, quantityDelivered),
    onSuccess: () => client.invalidateQueries({ queryKey: PRODUCTION_KEYS.day(date) }),
  });
}
