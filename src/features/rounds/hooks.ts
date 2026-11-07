"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { roundsApi } from "./api";

export const ROUND_KEYS = {
  all: ["rounds"] as const,
  day: (date: string) => ["rounds", "day", date] as const,
  live: ["rounds", "live"] as const,
};

export function useRoundsDay(date: string) {
  return useQuery({ queryKey: ROUND_KEYS.day(date), queryFn: () => roundsApi.day(date), placeholderData: (previous) => previous });
}

/** ADM-08 : suivi en direct, rafraîchi toutes les 15 s (et au retour sur l'onglet). */
export function useLiveDashboard() {
  return useQuery({ queryKey: ROUND_KEYS.live, queryFn: roundsApi.live, refetchInterval: 15_000, refetchOnWindowFocus: true });
}

/** Toute écriture relit le jour (ordre, numéros et journal viennent du serveur). */
export function useRoundMutation<TInput, TResult>(date: string, mutationFn: (input: TInput) => Promise<TResult>) {
  const client = useQueryClient();
  return useMutation({
    mutationFn,
    onSettled: () => client.invalidateQueries({ queryKey: ROUND_KEYS.day(date) }),
  });
}
