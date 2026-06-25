"use client";

import { useQuery } from "@tanstack/react-query";
import {
  DEFAULT_DRIVER_LOCATION_SETTINGS,
  type DriverLocationSettings,
} from "@/lib/validations/driver-location-settings";

async function fetchLocationSettings(): Promise<DriverLocationSettings> {
  const res = await fetch("/api/driver/location/settings");
  const json = await res.json();
  if (!res.ok) throw new Error(json.error ?? "Erreur serveur");
  return json.data as DriverLocationSettings;
}

export function useDriverLocationSettings() {
  return useQuery({
    queryKey: ["driver", "location-settings"],
    queryFn: fetchLocationSettings,
    staleTime: 5 * 60 * 1000,
    placeholderData: DEFAULT_DRIVER_LOCATION_SETTINGS,
  });
}
