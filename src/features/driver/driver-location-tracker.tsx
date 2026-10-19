"use client";

import { useDriverService } from "@/features/driver/driver-service-control";
import { useMemo } from "react";
import { usePathname } from "next/navigation";
import { DEFAULT_DRIVER_LOCATION_SETTINGS } from "@/lib/validations/driver-location-settings";
import { hasActiveDriverMission } from "@/lib/constants/driver-location";
import { useDriverMissions } from "@/features/driver/hooks";
import { useDriverLocationSettings } from "@/features/driver/location-settings-hooks";
import { useDriverLivePosition } from "@/features/driver/use-driver-live-position";
import { DriverLocationStatus } from "@/features/driver/driver-location-status";

export function DriverLocationTracker() {
  const service = useDriverService();
  const serviceActive = service.data?.active === true && !service.error;
  const pathname = usePathname();
  const isNavigatePage = pathname.startsWith("/driver/navigate");
  const { data: settings } = useDriverLocationSettings();
  const missions = useDriverMissions();
  const missionData = missions.data;

  const locationSettings = settings ?? DEFAULT_DRIVER_LOCATION_SETTINGS;
  const hasActiveMission = useMemo(
    () => hasActiveDriverMission(missionData?.missions),
    [missionData?.missions]
  );

  const enabled = !isNavigatePage && serviceActive && hasActiveMission;
  const tracking = useDriverLivePosition(enabled, {
    minSendIntervalMs: Math.min(locationSettings.activeMissionIntervalSeconds * 1000, 4_000),
    staleAfterMs: locationSettings.onlineThresholdSeconds * 1000,
  });

  if (isNavigatePage) return null;

  let status = tracking.status;
  let detail: string | undefined;
  let error = tracking.syncError;
  if (service.error || missions.error) {
    status = "sync-error";
    error = service.error?.message ?? missions.error?.message ?? "État du suivi indisponible.";
  } else if (!service.data || !missionData) {
    status = "requesting";
    detail = "Vérification du service et des missions…";
  } else if (!serviceActive) {
    status = "stopped";
    detail = "Partage GPS arrêté : service fermé.";
  } else if (!hasActiveMission) {
    status = "stopped";
    detail = "Partage GPS en attente : aucune mission démarrée.";
  }

  return (
    <div className="mx-4 mb-4" aria-label="État de synchronisation GPS">
      <DriverLocationStatus
        status={status}
        detail={detail}
        error={error}
        lastPositionAt={tracking.lastPositionAt}
        lastSyncedAt={tracking.lastSyncedAt}
        onRetry={() => {
          tracking.retry();
          void service.refetch();
          void missions.refetch();
        }}
      />
    </div>
  );
}
