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
