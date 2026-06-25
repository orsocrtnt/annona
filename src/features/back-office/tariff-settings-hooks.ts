"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { CompanyTariffSettings } from "@/lib/validations/tariff-settings";
import { tariffSettingsApi } from "./tariff-settings-api";

export function useCompanyTariffSettings() {
  return useQuery({
    queryKey: ["company", "settings", "tariffs"],
    queryFn: tariffSettingsApi.get,
    retry: 1,
  });
}

export function useUpdateCompanyTariffSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CompanyTariffSettings) => tariffSettingsApi.update(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["company", "settings"] });
    },
  });
}
