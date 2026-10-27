"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { useMemo, useState } from "react";
import { ArrowLeft, ExternalLink, LocateFixed } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageLoader } from "@/components/ui/loader";
import { DriverNavigationHud } from "@/features/driver/driver-navigation-hud";
import { DriverLocationStatus } from "@/features/driver/driver-location-status";
import { useDriverMissionNavigation } from "@/features/driver/hooks";
import { useWakeLock } from "@/features/driver/use-wake-lock";
import { useDriverLivePosition } from "@/features/driver/use-driver-live-position";
import { useDriverHeading } from "@/features/driver/use-driver-heading";
import { useDriverRoute } from "@/features/driver/use-driver-route";
import { getNavigationGuidance } from "@/lib/maps/navigation-guidance";
import { formatDistance, formatDuration, haversineMeters } from "@/lib/maps/navigation-utils";

interface DriverNavigationScreenProps {
  missionId: string;
}

const DriverNavigationMap = dynamic(
  () => import("@/components/maps/driver-navigation-map").then((module) => module.DriverNavigationMap),
  {
    ssr: false,
    loading: () => <div className="h-full w-full bg-[#ececea]" aria-label="Chargement de la carte" />,
  }
);

export function DriverNavigationScreen({ missionId }: DriverNavigationScreenProps) {
  const { data: navigation, isLoading, error } = useDriverMissionNavigation(missionId);
  const tracking = useDriverLivePosition(Boolean(navigation?.canNavigate));
  const { position } = tracking;
  const heading = useDriverHeading(position);
  const [followDriver, setFollowDriver] = useState(true);
  useWakeLock(Boolean(navigation?.canNavigate));
  const target = navigation?.target ?? null;
  const { route, loading: routeLoading, unavailable: routeUnavailable, retry: loadRoute } = useDriverRoute(position, target);

  const guidance = useMemo(() => {
    if (!position || !route?.steps.length) return null;
    return getNavigationGuidance(position, route.steps);
  }, [position, route?.steps]);

  const distanceToTarget = useMemo(() => {
    if (!position || !target) return null;
    return haversineMeters(position, target);
  }, [position, target]);

  const externalAddress = target?.address || navigation?.destinationQuery;
  const googleMapsUrl = externalAddress
    ? `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(externalAddress)}${
        position
          ? `&origin=${encodeURIComponent(`${position.latitude},${position.longitude}`)}`
          : ""
      }&travelmode=driving`
    : null;

  if (isLoading) {
    return (
      <div className="flex h-[100dvh] items-center justify-center bg-[#ececea]">
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
    <div className="relative h-[100dvh] w-full overflow-hidden bg-[#ececea]">
      <h1 className="sr-only">
        {target ? `Itinéraire — ${target.label} : ${target.address}` : "Itinéraire de la mission"}
      </h1>
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
              <ArrowLeft className="mr-1.5 h-4 w-4" aria-hidden="true" />
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
              <LocateFixed className="mr-1.5 h-4 w-4" aria-hidden="true" />
              Me recentrer
            </Button>
          )}
        </div>

        {navigation.canNavigate && (
          <DriverNavigationHud
            guidance={guidance}
            unavailable={routeUnavailable}
            waitingForPosition={!position}
            loading={routeLoading && !route}
            destinationLabel={target?.label ?? "Destination"}
            remainingLabel={route ? formatDistance(route.distanceMeters) : distanceToTarget != null ? `${formatDistance(distanceToTarget)} à vol d’oiseau` : "—"}
            etaLabel={route ? formatDuration(route.durationSeconds) : null}
          />
        )}
      </div>

      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-[1000] p-3 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <div className="pointer-events-auto space-y-2">
          {!navigation.canNavigate ? (
            <div className="rounded-2xl bg-white/95 p-4 shadow-lg">
              <p className="text-sm font-medium">{navigation.unavailableReason}</p>
              {googleMapsUrl && <a className="mt-3 block rounded-sm underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" href={googleMapsUrl} target="_blank" rel="noopener noreferrer">Ouvrir l’adresse dans Google Maps<span className="sr-only"> (nouvel onglet)</span></a>}
              <Button variant="outline" size="lg" className="mt-3 w-full" asChild>
                <Link href="/driver/missions">Retour aux missions</Link>
              </Button>
            </div>
          ) : (
            <>
              <p className="rounded-xl border border-black/10 bg-white/95 px-3 py-2 text-center text-[11px] text-muted-foreground shadow">
                Gardez TutelLiv ouvert · durée indicative hors trafic
              </p>
              <div className="rounded-2xl border border-black/10 bg-white/95 p-3 shadow-lg">
                {/* L'étape (collecte, livraison) en repère, l'adresse en tête : c'est elle qu'on cherche. */}
                {target?.label && <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{target.label}</p>}
                <p className="line-clamp-2 text-base font-semibold text-foreground">{target?.address}</p>
                <div className="mt-2 flex gap-2">
                  {googleMapsUrl && (
                    <Button variant="outline" size="default" className="flex-1" asChild>
                      <a href={googleMapsUrl} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="mr-1.5 h-4 w-4" aria-hidden="true" />
                        Google Maps
                        <span className="sr-only"> (nouvel onglet)</span>
                      </a>
                    </Button>
                  )}
                </div>
                <div className="mt-2">
                  <DriverLocationStatus
                    compact
                    status={tracking.status}
                    error={tracking.syncError}
                    lastPositionAt={tracking.lastPositionAt}
                    lastSyncedAt={tracking.lastSyncedAt}
                    onRetry={tracking.retry}
                  />
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
