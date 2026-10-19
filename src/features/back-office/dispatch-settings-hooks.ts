"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { CompanyDispatchSettings } from "@/lib/validations/dispatch-settings";
import { dispatchSettingsApi } from "./dispatch-settings-api";

export function useCompanyDispatchSettings() {
  return useQuery({
    queryKey: ["company", "settings", "dispatch"],
    queryFn: dispatchSettingsApi.get,
    retry: 1,
  });
}

export function useUpdateCompanyDispatchSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CompanyDispatchSettings) => dispatchSettingsApi.update(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["company", "settings"] });
    },
  });
}

export function useRunAutoDispatch() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => dispatchSettingsApi.runAutoAssign(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["company"] });
    },
  });
}

export function useOperationJobHealth() {
  return useQuery({
    queryKey: ["company", "operation-jobs"],
    queryFn: dispatchSettingsApi.getOperationJobHealth,
    retry: 1,
    refetchInterval: 30_000,
  });
}

export function useRetryFailedOperationJobs() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: dispatchSettingsApi.retryFailedOperationJobs,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["company", "operation-jobs"] });
      qc.invalidateQueries({ queryKey: ["company"] });
    },
  });
}
