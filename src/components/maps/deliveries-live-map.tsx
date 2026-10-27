"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { withoutRolePrefix } from "@/lib/format/person-labels";
import type { Map as LeafletMap } from "leaflet";
import { Polyline, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";
import { clusterProjectedPoints } from "@/lib/maps/cluster-points";
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
import {
  DeliveryClusterMarker,
  DeliveryOverviewMarker,
  DeliveryPointMarker,
} from "@/components/maps/delivery-point-marker";
import { getDispatchMapStatus } from "@/features/back-office/dispatch-map-status";
import { DriverMapMarker } from "@/components/maps/driver-map-marker";
import { LeafletBaseMap, PARIS_CENTER } from "@/components/maps/leaflet-base-map";
import { MAP_ROUTE_STYLE } from "@/lib/maps/map-visual-theme";
import { useUIStore } from "@/stores/ui.store";

export type DeliveriesMapApi = {
  zoomIn: () => void;
  zoomOut: () => void;
};

interface DeliveriesLiveMapProps {
  delivery: DispatchMapDelivery | null;
  /** Vue d'ensemble quand aucune livraison n'est sélectionnée : toutes les épingles et les livreurs. */
  deliveries?: DispatchMapDelivery[];
  /** Clic sur une livraison (deux clics rapprochés = double-clic, géré par la page). */
  onSelect?: (id: string) => void;
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
  const points: [number, number][] = delivery.destination ? [
    [delivery.destination.latitude, delivery.destination.longitude],
  ] : [];
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

    // Le livreur qui roule ne recadre pas la carte : seule son apparition ou sa disparition compte.
    const fitKey = [
      delivery.id,
      delivery.driverLocation ? "driver" : "no-driver",
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

/** Cadre la carte sur toutes les livraisons visibles (où qu'elles soient) et leurs livreurs. */
function OverviewViewController({ points }: { points: [number, number][] }) {
  const map = useMap();
  const sidebarCollapsed = useUIStore((s) => s.sidebarCollapsed);
  const fitKey = points.map(([lat, lng]) => `${lat.toFixed(4)},${lng.toFixed(4)}`).join(";");
  const prevFitKey = useRef<string | null>(null);

  useEffect(() => {
    const key = `${fitKey}|${sidebarCollapsed ? "sb-c" : "sb-e"}`;
    if (!fitKey || key === prevFitKey.current) return;
    prevFitKey.current = key;
    const applyFit = () => {
      map.invalidateSize({ animate: false });
      // Marge supplémentaire : les épingles et leurs fiches dépassent au-dessus du point GPS.
      const padding = getDispatchMapFitPadding(map);
      fitMapPointsWithPadding(
        map,
        points,
        { top: padding.top + 120, right: padding.right + 56, bottom: padding.bottom + 40, left: padding.left + 40 },
        14,
        13
      );
    };
    applyFit();
    const timers = FIT_RETRY_DELAYS.map((ms) => window.setTimeout(applyFit, ms));
    return () => timers.forEach((t) => window.clearTimeout(t));
  }, [fitKey, map, points, sidebarCollapsed]);

  return null;
}

function OverviewLayer({
  deliveries,
  onSelect,
}: {
  deliveries: DispatchMapDelivery[];
  onSelect?: (id: string) => void;
}) {
  const located = deliveries.filter((delivery) => delivery.destination && !delivery.isHistorical);
  const drivers = new Map<string, DispatchMapDelivery>();
  for (const delivery of located) {
    if (delivery.driverId && delivery.driverLocation && delivery.driverName && showDriverOnMap(delivery)) {
      drivers.set(delivery.driverId, delivery);
    }
  }
  const points = useMemo<[number, number][]>(
    () => [
      ...located.map((d) => [d.destination!.latitude, d.destination!.longitude] as [number, number]),
      ...[...drivers.values()].map((d) => [d.driverLocation!.latitude, d.driverLocation!.longitude] as [number, number]),
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps -- clé stable : positions arrondies
    [located.map((d) => d.id).join(), [...drivers.keys()].join()]
  );

  const map = useMap();
  const [zoom, setZoom] = useState(() => map.getZoom());
  useMapEvents({ zoomend: () => setZoom(map.getZoom()), moveend: () => setZoom(map.getZoom()) });
  // Le premier cadrage (contrôleur enfant) précède l'abonnement : resynchroniser après les cadrages.
  useEffect(() => {
    const timers = [0, ...FIT_RETRY_DELAYS].map((ms) => window.setTimeout(() => setZoom(map.getZoom()), ms + 20));
    return () => timers.forEach((t) => window.clearTimeout(t));
  }, [map, points]);
  // Au-delà du zoom 13, chaque livraison garde son épingle ; en dessous, regroupement par zone.
  const clusters = useMemo(
    () =>
      clusterProjectedPoints(
        located.map((delivery) => {
          const point = map.project([delivery.destination!.latitude, delivery.destination!.longitude], zoom);
          return { item: delivery, x: point.x, y: point.y };
        }),
        zoom >= 13 ? 1 : 64
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- clé stable : identifiants et zoom
    [located.map((d) => d.id).join(), zoom, map]
  );

  return (
    <>
      <OverviewViewController points={points} />
      {clusters.map((cluster) => {
        if (cluster.items.length === 1) {
          const delivery = cluster.items[0]!;
          return (
            <DeliveryOverviewMarker
              key={delivery.id}
              latitude={delivery.destination!.latitude}
              longitude={delivery.destination!.longitude}
              reference={delivery.reference}
              title={withoutRolePrefix(delivery.customerName) || delivery.address}
              status={getDispatchMapStatus(delivery)}
              subtitle={delivery.driverName ? withoutRolePrefix(delivery.driverName) : undefined}
              showCallout={zoom >= 11}
              onSelect={() => onSelect?.(delivery.id)}
            />
          );
        }
        const center = map.unproject([cluster.x, cluster.y], zoom);
        const bounds = L.latLngBounds(cluster.items.map((d) => [d.destination!.latitude, d.destination!.longitude] as [number, number]));
        return (
          <DeliveryClusterMarker
            key={cluster.items.map((d) => d.id).join("-")}
            latitude={center.lat}
            longitude={center.lng}
            count={cluster.items.length}
            hasLate={cluster.items.some((d) => getDispatchMapStatus(d) === "late")}
            onSelect={() => {
              // Même marges que le cadrage d'ensemble : la liste de gauche ne masque aucune épingle.
              const padding = getDispatchMapFitPadding(map);
              map.flyToBounds(bounds, {
                paddingTopLeft: L.point(padding.left + 40, padding.top + 120),
                paddingBottomRight: L.point(padding.right + 56, padding.bottom + 40),
                maxZoom: 14,
              });
            }}
          />
        );
      })}
      {[...drivers.values()].map((delivery) => (
        <DriverMapMarker
          key={delivery.driverId}
          name={delivery.driverName!}
          latitude={delivery.driverLocation!.latitude}
          longitude={delivery.driverLocation!.longitude}
          isOnline={delivery.driverLocation!.isOnline}
          estimated={delivery.driverLocation!.estimated}
          motion={delivery.driverLocation!.motion}
          updatedAt={delivery.driverLocation!.updatedAt}
          showLabel={zoom >= 13}
          onSelect={() => onSelect?.(delivery.id)}
        />
      ))}
    </>
  );
}

function DeliveryRouteLayer({ delivery, driverMoving }: { delivery: DispatchMapDelivery; driverMoving: boolean }) {
  const [route, setRoute] = useState<[number, number][]>([]);
  const [unavailable, setUnavailable] = useState(false);
  // Livreur en mouvement : son tronçon vers la prochaine étape est tracé (et effacé derrière lui)
  // par son marqueur ; cette couche ne garde que la suite du parcours.
  const all = getDeliveryRouteWaypoints(delivery);
  const remaining = all && driverMoving ? all.slice(1) : all;
  const waypointsKey = JSON.stringify(remaining?.map((w) => [w.latitude.toFixed(5), w.longitude.toFixed(5)]) ?? null);
  // eslint-disable-next-line react-hooks/exhaustive-deps -- clé stable : points de passage arrondis
  const waypoints = useMemo(() => remaining, [waypointsKey]);

  useEffect(() => {
    if (!waypoints || waypoints.length < 2) {
      setRoute([]);
      return;
    }

    const controller = new AbortController();
    setRoute([]);
    setUnavailable(false);
    const initial = setTimeout(() => {
      void fetchOsrmRoute(waypoints, controller.signal).then((coords) => {
        if (!controller.signal.aborted) { setRoute(coords ?? []); setUnavailable(!coords); }
      });
    }, 0);

    return () => {
      clearTimeout(initial);
      controller.abort();
    };
  }, [waypoints]);

  if (unavailable) return <div role="status" className="pointer-events-none absolute bottom-36 right-3 z-[1000] max-w-[80%] rounded-xl bg-white/95 px-3 py-2 text-sm shadow">Itinéraire indisponible · positions seules</div>;
  if (route.length < 2) return null;

  return <>
    <Polyline positions={route} pathOptions={MAP_ROUTE_STYLE.halo} />
    <Polyline positions={route} pathOptions={MAP_ROUTE_STYLE.line} />
  </>;
}

export function DeliveriesLiveMap({ delivery, deliveries = [], onSelect, onMapReady }: DeliveriesLiveMapProps) {
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
      {!delivery && <OverviewLayer deliveries={deliveries} onSelect={onSelect} />}

      {delivery && !delivery.isHistorical && (
        <DeliveryRouteLayer delivery={delivery} driverMoving={Boolean(showDriver && delivery.driverLocation?.motion)} />
      )}

      {delivery && !delivery.destination && <div role="status" className="pointer-events-none absolute right-3 top-1/2 z-[1000] max-w-[85%] rounded-xl bg-white/95 px-3 py-2 text-sm shadow">Adresse non localisée · position de livraison indisponible</div>}

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
          status={marker.kind === "destination" && delivery ? getDispatchMapStatus(delivery) : undefined}
          onClick={marker.kind === "destination" && delivery ? () => onSelect?.(delivery.id) : undefined}
        />
      ))}

      {showDriver && delivery.driverLocation && delivery.driverName && (
        <DriverMapMarker
          name={delivery.driverName}
          latitude={delivery.driverLocation.latitude}
          longitude={delivery.driverLocation.longitude}
          isSelected={Boolean(delivery.missionStartedAt)}
          isOnline={delivery.driverLocation.isOnline}
          estimated={delivery.driverLocation.estimated}
          motion={delivery.driverLocation.motion}
          updatedAt={delivery.driverLocation.updatedAt}
          showTrail
        />
      )}
    </LeafletBaseMap>
  );
}
