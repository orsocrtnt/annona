"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { CompanyDeliveryOptions } from "@/lib/validations/company-settings";
import { companySettingsApi } from "./company-settings-api";

export function useCompanyDeliveryOptions() {
  return useQuery({
    queryKey: ["company", "settings", "delivery-options"],
    queryFn: companySettingsApi.getDeliveryOptions,
  });
}

export function useUpdateCompanyDeliveryOptions() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CompanyDeliveryOptions) => companySettingsApi.updateDeliveryOptions(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["company", "settings"] });
      qc.invalidateQueries({ queryKey: ["portal", "delivery-options"] });
    },
  });
}

export function useCompanyPortalSettings() {
  return useQuery({
    queryKey: ["company", "settings", "portal"],
    queryFn: companySettingsApi.getPortalSettings,
  });
}

export function useUpdateCompanyPortalSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { portalShowDriverPhone: boolean }) => companySettingsApi.updatePortalSettings(data),
    onSuccess: (data) => {
      qc.setQueryData(["company", "settings", "portal"], data);
      qc.invalidateQueries({ queryKey: ["portal", "deliveries"] });
    },
  });
}
