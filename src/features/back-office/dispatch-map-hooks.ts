"use client";

import { useQuery } from "@tanstack/react-query";
import type { LiveDriverLocation } from "@/domains/driver/driver-location.service";
import type {
  DispatchMapDelivery,
  DispatchMapPoint,
} from "@/domains/delivery/dispatch-map.service";
import { DEFAULT_DRIVER_LOCATION_SETTINGS } from "@/lib/validations/driver-location-settings";
import { useCompanyLocationSettings } from "./location-settings-hooks";

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  const json = await res.json();
  if (!res.ok) throw new Error(json.error ?? "Erreur serveur");
  return json.data as T;
}

/** `live` faux : un seul chargement, sans rafraîchissement (vue inactive de la carte unifiée). */
export function useDispatchDeliveriesMap(live = true) {
  const { data: locationSettings } = useCompanyLocationSettings();
  const refreshMs =
    (locationSettings?.adminMapRefreshSeconds ??
      DEFAULT_DRIVER_LOCATION_SETTINGS.adminMapRefreshSeconds) * 1000;

  return useQuery({
    queryKey: ["company", "dispatch", "map"],
    queryFn: () =>
      fetchJson<{ deliveries: DispatchMapDelivery[]; points: DispatchMapPoint[] }>(
        "/api/dispatch/map"
      ),
    retry: 1,
    refetchInterval: (query) =>
      query.state.status === "error" || !live ? false : refreshMs,
  });
}

export function useDriverLiveLocations(enabled = true, live = true) {
  const { data: locationSettings } = useCompanyLocationSettings();
  const refreshMs =
    (locationSettings?.adminMapRefreshSeconds ??
      DEFAULT_DRIVER_LOCATION_SETTINGS.adminMapRefreshSeconds) * 1000;

  return useQuery({
    queryKey: ["company", "dispatch", "drivers-locations"],
    queryFn: () => fetchJson<LiveDriverLocation[]>("/api/dispatch/drivers-locations"),
    enabled,
    retry: 1,
    refetchInterval: (query) =>
      query.state.status === "error" || !live ? false : refreshMs,
  });
}
