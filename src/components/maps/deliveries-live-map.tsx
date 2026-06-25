"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Map as LeafletMap } from "leaflet";
import { Polyline, useMap } from "react-leaflet";
import type { DispatchMapDelivery } from "@/domains/delivery/dispatch-map.service";
import {
  buildDeliveryMapMarkers,
  getDeliveryMapPhaseHint,
  getDeliveryRouteWaypoints,
  showDriverOnMap,
} from "@/features/back-office/dispatch-delivery-map-state";
import { fetchOsrmRoute } from "@/lib/maps/osrm-route";
import {
  getDispatchMapFitPadding,
  fitMapPointsWithPadding,
} from "@/lib/maps/map-fit-padding";
import { DeliveryPointMarker } from "@/components/maps/delivery-point-marker";
import { DriverMapMarker } from "@/components/maps/driver-map-marker";
import { LeafletBaseMap, PARIS_CENTER } from "@/components/maps/leaflet-base-map";
import { useUIStore } from "@/stores/ui.store";

export type DeliveriesMapApi = {
  zoomIn: () => void;
  zoomOut: () => void;
};

interface DeliveriesLiveMapProps {
  delivery: DispatchMapDelivery | null;
  onMapReady?: (api: DeliveriesMapApi) => void;
}

function MapApiBridge({ onMapReady }: { onMapReady?: (api: DeliveriesMapApi) => void }) {
  const map = useMap();

  useEffect(() => {
    onMapReady?.({
      zoomIn: () => map.zoomIn(),
      zoomOut: () => map.zoomOut(),
    });
  }, [map, onMapReady]);

  return null;
}

const FIT_RETRY_DELAYS = [50, 150, 320, 500, 800] as const;

function fitMapToDelivery(map: LeafletMap, delivery: DispatchMapDelivery) {
  const points: [number, number][] = [
    [delivery.destination.latitude, delivery.destination.longitude],
  ];
  if (delivery.pickup) {
    points.push([delivery.pickup.latitude, delivery.pickup.longitude]);
  }
  if (delivery.driverLocation) {
    points.push([delivery.driverLocation.latitude, delivery.driverLocation.longitude]);
  }
  delivery.trackingSteps.forEach((step) => {
    if (step.latitude != null && step.longitude != null) {
      points.push([step.latitude, step.longitude]);
    }
  });

  const padding = getDispatchMapFitPadding(map);
  fitMapPointsWithPadding(map, points, padding, 15, 14);
}

function MapViewController({ delivery }: { delivery: DispatchMapDelivery | null }) {
  const map = useMap();
  const sidebarCollapsed = useUIStore((s) => s.sidebarCollapsed);
  const prevFitKey = useRef<string | null>(null);

  useEffect(() => {
    if (!delivery) {
      prevFitKey.current = null;
      return;
    }

    const fitKey = [
      delivery.id,
      delivery.driverLocation?.latitude?.toFixed(5) ?? "no-driver",
      delivery.driverLocation?.longitude?.toFixed(5) ?? "no-driver",
      delivery.missionStartedAt ?? "pre-mission",
      sidebarCollapsed ? "sb-c" : "sb-e",
    ].join("|");

    if (fitKey === prevFitKey.current) return;
    prevFitKey.current = fitKey;

    const applyFit = () => {
      map.invalidateSize({ animate: false });
      fitMapToDelivery(map, delivery);
    };

    applyFit();
    const timers = FIT_RETRY_DELAYS.map((ms) => window.setTimeout(applyFit, ms));

    const page = map.getContainer().closest("[data-dispatch-map-page]");
    const panel = page?.querySelector("[data-dispatch-map-panel]");
    const resizeObserver =
      panel && typeof ResizeObserver !== "undefined"
        ? new ResizeObserver(() => applyFit())
        : null;
    if (panel) resizeObserver?.observe(panel);

    return () => {
      timers.forEach((t) => window.clearTimeout(t));
      resizeObserver?.disconnect();
    };
  }, [delivery, map, sidebarCollapsed]);

  return null;
}

function DeliveryRouteLayer({ delivery }: { delivery: DispatchMapDelivery }) {
  const [route, setRoute] = useState<[number, number][]>([]);
  const waypoints = useMemo(() => getDeliveryRouteWaypoints(delivery), [delivery]);

  useEffect(() => {
    if (!waypoints || waypoints.length < 2) {
      setRoute([]);
      return;
    }

    let cancelled = false;
    fetchOsrmRoute(waypoints).then((coords) => {
      if (!cancelled) setRoute(coords);
    });

    return () => {
      cancelled = true;
    };
  }, [waypoints]);

  if (route.length < 2) return null;

  return (
    <Polyline
      positions={route}
      pathOptions={{ color: "#2563eb", weight: 5, opacity: 0.85, lineCap: "round" }}
    />
  );
}

export function DeliveriesLiveMap({ delivery, onMapReady }: DeliveriesLiveMapProps) {
  const markers = useMemo(
    () => (delivery ? buildDeliveryMapMarkers(delivery) : []),
    [delivery]
  );

  const showDriver = delivery && !delivery.isHistorical && showDriverOnMap(delivery);
  const phaseHint =
    delivery && !delivery.isHistorical ? getDeliveryMapPhaseHint(delivery) : null;
  const mutedMarkers = delivery?.isHistorical ?? false;

  return (
    <LeafletBaseMap fill variant="uber" className="h-full w-full" center={PARIS_CENTER}>
      <MapApiBridge onMapReady={onMapReady} />
      <MapViewController delivery={delivery} />

      {delivery && !delivery.isHistorical && <DeliveryRouteLayer delivery={delivery} />}

      {phaseHint && (
        <div className="pointer-events-none absolute inset-x-0 bottom-24 z-[1000] flex justify-center px-4">
          <p className="rounded-full bg-white/95 px-4 py-2 text-sm text-muted-foreground shadow-md">
            {phaseHint}
          </p>
        </div>
      )}

      {markers.map((marker) => (
        <DeliveryPointMarker
          key={marker.id}
          kind={marker.kind}
          latitude={marker.latitude}
          longitude={marker.longitude}
          label={marker.label}
          subtitle={marker.subtitle}
          stepIndex={marker.stepIndex}
          isSelected={marker.kind === "destination"}
          muted={mutedMarkers}
        />
      ))}

      {showDriver && delivery.driverLocation && delivery.driverName && (
        <DriverMapMarker
          name={delivery.driverName}
          latitude={delivery.driverLocation.latitude}
          longitude={delivery.driverLocation.longitude}
          isSelected={Boolean(delivery.missionStartedAt)}
          isOnline={delivery.driverLocation.isOnline}
          updatedAt={delivery.driverLocation.updatedAt}
        />
      )}
    </LeafletBaseMap>
  );
}
