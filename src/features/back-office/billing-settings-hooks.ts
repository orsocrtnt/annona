"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { CompanyBillingSettings } from "@/lib/validations/billing-settings";
import { billingSettingsApi } from "./billing-settings-api";

export function useCompanyBillingSettings() {
  return useQuery({
    queryKey: ["company", "settings", "billing"],
    queryFn: billingSettingsApi.get,
    retry: 1,
  });
}

export function useUpdateCompanyBillingSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CompanyBillingSettings) => billingSettingsApi.update(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["company", "settings"] });
      qc.invalidateQueries({ queryKey: ["company", "settings", "billing"] });
    },
  });
}
