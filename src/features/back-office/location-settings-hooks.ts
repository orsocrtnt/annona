"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { DriverLocationSettings } from "@/lib/validations/driver-location-settings";
import { locationSettingsApi } from "./location-settings-api";

export function useCompanyLocationSettings() {
  return useQuery({
    queryKey: ["company", "settings", "location"],
    queryFn: locationSettingsApi.get,
  });
}

export function useUpdateCompanyLocationSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: DriverLocationSettings) => locationSettingsApi.update(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["company", "settings", "location"] });
      qc.invalidateQueries({ queryKey: ["company", "dispatch", "drivers-locations"] });
    },
  });
}
