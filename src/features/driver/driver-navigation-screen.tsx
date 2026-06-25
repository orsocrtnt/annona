"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, ExternalLink, LocateFixed } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageLoader } from "@/components/ui/loader";
import { DriverNavigationMap } from "@/components/maps/driver-navigation-map";
import { DriverNavigationHud } from "@/features/driver/driver-navigation-hud";
import { useDriverMissionNavigation } from "@/features/driver/hooks";
import { useWakeLock } from "@/features/driver/use-wake-lock";
import { useDriverLivePosition } from "@/features/driver/use-driver-live-position";
import { useDriverHeading } from "@/features/driver/use-driver-heading";
import { fetchOsrmNavigationRoute } from "@/lib/maps/osrm-route";
import type { NavigationRoute } from "@/lib/maps/osrm-route";
import { getNavigationGuidance } from "@/lib/maps/navigation-guidance";
import { formatDistance, formatDuration, haversineMeters } from "@/lib/maps/navigation-utils";

interface DriverNavigationScreenProps {
  missionId: string;
}

export function DriverNavigationScreen({ missionId }: DriverNavigationScreenProps) {
  const { data: navigation, isLoading, error } = useDriverMissionNavigation(missionId);
  const { position, status: gpsStatus } = useDriverLivePosition(true);
  const heading = useDriverHeading(position);
  const [route, setRoute] = useState<NavigationRoute | null>(null);
  const [routeLoading, setRouteLoading] = useState(false);
  const [followDriver, setFollowDriver] = useState(true);
  const positionRef = useRef(position);

  positionRef.current = position;

  useWakeLock(Boolean(navigation?.canNavigate));

  const target = navigation?.target ?? null;

  const loadRoute = useCallback(async () => {
    const currentPosition = positionRef.current;
    if (!target || !currentPosition) return;
    setRouteLoading(true);
    try {
      const nextRoute = await fetchOsrmNavigationRoute([
        {
          latitude: currentPosition.latitude,
          longitude: currentPosition.longitude,
          label: "Vous",
        },
        {
          latitude: target.latitude,
          longitude: target.longitude,
          label: target.label,
        },
      ]);
      setRoute(nextRoute);
    } finally {
      setRouteLoading(false);
    }
  }, [target]);

  useEffect(() => {
    if (!target) return;
    void loadRoute();
    const intervalId = window.setInterval(() => void loadRoute(), 25_000);
    return () => window.clearInterval(intervalId);
  }, [target, loadRoute]);

  useEffect(() => {
    if (!position || !target) return;
    void loadRoute();
  }, [position?.latitude, position?.longitude, target, loadRoute]);

  const guidance = useMemo(() => {
    if (!position || !route?.steps.length) return null;
    return getNavigationGuidance(position, route.steps);
  }, [position, route?.steps]);

  const distanceToTarget = useMemo(() => {
    if (!position || !target) return null;
    return haversineMeters(position, target);
  }, [position, target]);

  const googleMapsUrl = target
    ? `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(target.address)}${
        position
          ? `&origin=${encodeURIComponent(`${position.latitude},${position.longitude}`)}`
          : ""
      }&travelmode=driving`
    : null;

  if (isLoading) {
    return (
      <div className="flex h-[100dvh] items-center justify-center bg-[#f0f0f0]">
        <PageLoader />
      </div>
    );
  }

  if (error || !navigation) {
    return (
      <div className="flex h-[100dvh] flex-col items-center justify-center gap-4 p-6 text-center">
        <p className="text-sm text-muted-foreground">Impossible de charger la navigation.</p>
        <Button variant="outline" asChild>
          <Link href="/driver/missions">Retour aux missions</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="relative h-[100dvh] w-full overflow-hidden bg-[#eef2f7]">
      <div className="absolute inset-0">
        <DriverNavigationMap
          position={position}
          heading={heading}
          target={target}
          route={route}
          followDriver={followDriver}
          onUserInteraction={() => setFollowDriver(false)}
        />
      </div>

      <div className="pointer-events-none absolute inset-x-0 top-0 z-[1000] space-y-2 p-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <div className="pointer-events-auto flex items-center gap-2">
          <Button variant="secondary" size="default" className="shadow-md" asChild>
            <Link href="/driver/missions">
              <ArrowLeft className="mr-1.5 h-4 w-4" />
              Missions
            </Link>
          </Button>
          {!followDriver && (
            <Button
              variant="secondary"
              size="default"
              className="shadow-md"
              onClick={() => {
                setFollowDriver(true);
                void loadRoute();
              }}
            >
              <LocateFixed className="mr-1.5 h-4 w-4" />
              Me recentrer
            </Button>
          )}
        </div>

        {navigation.canNavigate && (
          <DriverNavigationHud
            guidance={guidance}
            loading={routeLoading && !route}
            destinationLabel={target?.label ?? "Destination"}
            remainingLabel={distanceToTarget != null ? formatDistance(distanceToTarget) : "—"}
            etaLabel={route ? formatDuration(route.durationSeconds) : null}
          />
        )}
      </div>

      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-[1000] p-3 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <div className="pointer-events-auto space-y-2">
          {!navigation.canNavigate ? (
            <div className="rounded-2xl bg-white/95 p-4 shadow-lg">
              <p className="text-sm font-medium">{navigation.unavailableReason}</p>
              <Button variant="outline" size="lg" className="mt-3 w-full" asChild>
                <Link href="/driver/missions">Retour aux missions</Link>
              </Button>
            </div>
          ) : (
            <>
              <p className="rounded-xl bg-white/90 px-3 py-2 text-center text-[11px] text-muted-foreground shadow">
                Gardez Tutelliv ouvert · le guidage se met à jour automatiquement
              </p>
              <div className="rounded-2xl bg-white/95 p-3 shadow-lg">
                <p className="line-clamp-2 text-sm text-foreground">{target?.address}</p>
                <div className="mt-2 flex gap-2">
                  {googleMapsUrl && (
                    <Button variant="outline" size="default" className="flex-1" asChild>
                      <a href={googleMapsUrl} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="mr-1.5 h-4 w-4" />
                        Google Maps
                      </a>
                    </Button>
                  )}
                </div>
                {gpsStatus === "denied" && (
                  <p className="mt-2 text-xs text-destructive">
                    Autorisez la localisation pour le guidage turn-by-turn.
                  </p>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
