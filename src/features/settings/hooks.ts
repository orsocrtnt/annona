"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { settingsApi, type ZoneRow } from "./api";

export const COMPANY_SETTINGS_KEY = ["company", "settings"] as const;
export const ZONES_KEY = ["company", "zones"] as const;

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

export function useZones(enabled = true) {
  return useQuery({ queryKey: ZONES_KEY, queryFn: settingsApi.zones, enabled });
}

/** Toute mutation de tournée renvoie la liste à jour. */
export function useZoneMutation<TInput>(fn: (input: TInput) => Promise<ZoneRow[]>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: (data) => {
      qc.setQueryData(ZONES_KEY, data);
      void qc.invalidateQueries({ queryKey: ["portal"] });
    },
  });
}
