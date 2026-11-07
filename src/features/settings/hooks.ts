"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { settingsApi, type SlotRow } from "./api";

export const COMPANY_SETTINGS_KEY = ["company", "settings"] as const;
const SLOTS_KEY = ["company", "slots"] as const;

export function useCompanySettings(enabled = true) {
  return useQuery({ queryKey: COMPANY_SETTINGS_KEY, queryFn: settingsApi.get, enabled, staleTime: 60_000 });
}

export function useUpdateCompanySettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: settingsApi.update,
    onSuccess: (data) => {
      qc.setQueryData(COMPANY_SETTINGS_KEY, data);
      // Le nom de l'entreprise est affiché dans l'en-tête (session) et les écrans de commande.
      void qc.invalidateQueries({ queryKey: ["auth"] });
      void qc.invalidateQueries({ queryKey: ["portal"] });
    },
  });
}

export function useSlots() {
  return useQuery({ queryKey: SLOTS_KEY, queryFn: settingsApi.slots });
}

/** Toute mutation de créneau renvoie la liste à jour. */
export function useSlotMutation<TInput>(fn: (input: TInput) => Promise<SlotRow[]>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: (data) => {
      qc.setQueryData(SLOTS_KEY, data);
      void qc.invalidateQueries({ queryKey: ["portal"] });
    },
  });
}
