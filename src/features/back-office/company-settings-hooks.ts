"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { CompanyDeliveryOptions } from "@/lib/validations/company-settings";
import type { CompanyDeliverySlots } from "@/lib/validations/delivery-slots";
import type { ProofRules } from "@/domains/delivery/pod-evidence";
import { companySettingsApi } from "./company-settings-api";

export function useCompanyDeliverySlots() {
  return useQuery({
    queryKey: ["company", "settings", "delivery-slots"],
    queryFn: companySettingsApi.getDeliverySlots,
  });
}

export function useUpdateCompanyDeliverySlots() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CompanyDeliverySlots) => companySettingsApi.updateDeliverySlots(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["company", "settings", "delivery-slots"] });
      qc.invalidateQueries({ queryKey: ["portal", "delivery-options"] });
    },
  });
}

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

export function useCompanyProofRules() {
  return useQuery({
    queryKey: ["company", "settings", "proof-rules"],
    queryFn: companySettingsApi.getProofRules,
  });
}

export function useUpdateCompanyProofRules() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<ProofRules>) => companySettingsApi.updateProofRules(data),
    onSuccess: (data) => qc.setQueryData(["company", "settings", "proof-rules"], data),
  });
}
