"use client";

import { useEffect, useMemo, useRef } from "react";
import L from "leaflet";
import { useMap } from "react-leaflet";
import type { DispatchMapDelivery } from "@/domains/delivery/dispatch-map.service";
import type { LiveDriverLocation } from "@/domains/driver/driver-location.service";
import { DriverMapMarker } from "@/components/maps/driver-map-marker";
import { DeliveryOverviewMarker, DeliveryPointMarker } from "@/components/maps/delivery-point-marker";
import { LeafletBaseMap, PARIS_CENTER } from "@/components/maps/leaflet-base-map";
import { getDispatchMapStatus } from "@/features/back-office/dispatch-map-status";
import { isLocatedDriver, locatedDeliveries, mapViewShows, sceneViewAction, type DashboardMapView } from "@/features/back-office/dashboard-map-model";

type Props = {
  view: DashboardMapView;
  drivers: LiveDriverLocation[];
  deliveries: DispatchMapDelivery[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  height: number;
};

/** Recadre quand l'ensemble des repères change ou qu'une sélection arrive, pas à chaque rafraîchissement GPS. */
function SceneView({ points, selected, selectedId, fitKey }: { points: [number, number][]; selected: [number, number] | null; selectedId: string | null; fitKey: string }) {
  const map = useMap();
  const selectedRef = useRef(selected);
  selectedRef.current = selected;
  const lastSelectedId = useRef<string | null>(null);
  const hasSelected = selected !== null;
  const lastFit = useRef("");
  const pointsRef = useRef(points);
  pointsRef.current = points;

  useEffect(() => {
    const target = selectedRef.current;
    const action = sceneViewAction({ selectedId, hasTarget: target !== null, lastCenteredId: lastSelectedId.current, fitKey, lastFitKey: lastFit.current });
    if (action === "center") {
      lastSelectedId.current = selectedId;
      map.setView(target!, Math.max(map.getZoom(), 14), { animate: true });
      return;
    }
    if (action === "hold") return;
    lastSelectedId.current = null;
    if (action === "none") return;
    lastFit.current = fitKey;
    const list = pointsRef.current;
    const apply = () => {
      map.invalidateSize({ animate: false });
      if (list.length === 0) map.setView(PARIS_CENTER, 11);
      else if (list.length === 1) map.setView(list[0]!, 14);
      else map.fitBounds(L.latLngBounds(list), { padding: [40, 40], maxZoom: 15, animate: false });
    };
    apply();
    const timers = [60, 250].map((ms) => window.setTimeout(apply, ms));
    return () => timers.forEach((t) => window.clearTimeout(t));
  }, [map, selectedId, fitKey, hasSelected]);

  return null;
}

export function DashboardMap({ view, drivers, deliveries, selectedId, onSelect, height }: Props) {
  const shows = mapViewShows(view);
  const located = useMemo(() => (shows.drivers ? drivers.filter(isLocatedDriver) : []), [shows.drivers, drivers]);
  const geoDeliveries = useMemo(() => (shows.deliveries ? locatedDeliveries(deliveries) : []), [shows.deliveries, deliveries]);
  const selectedDelivery = geoDeliveries.find((d) => d.id === selectedId);
  const selectedDriver = located.find((d) => d.id === selectedId);

  const points = useMemo<[number, number][]>(
    () => [
      ...located.map((d) => [d.latitude!, d.longitude!] as [number, number]),
      ...geoDeliveries.map((d) => [d.destination!.latitude, d.destination!.longitude] as [number, number]),
    ],
    [located, geoDeliveries]
  );
  const selectedPoint = useMemo<[number, number] | null>(() => {
    if (selectedDriver) return [selectedDriver.latitude!, selectedDriver.longitude!];
    return selectedDelivery?.destination ? [selectedDelivery.destination.latitude, selectedDelivery.destination.longitude] : null;
  }, [selectedDriver, selectedDelivery]);
  // Le cadrage ne dépend que des identifiants affichés pour les livreurs (leurs positions bougent), des positions pour les missions.
  const stableFitKey = [
    view,
    located.map((d) => d.id).sort().join("|"),
    geoDeliveries.map((d) => `${d.destination!.latitude},${d.destination!.longitude}`).sort().join("|"),
  ].join(":");

  return (
    <LeafletBaseMap height={height} variant="uber" zoom={11} className="w-full">
      <SceneView points={points} selected={selectedPoint} selectedId={selectedId} fitKey={stableFitKey} />
      {located.map((driver) => (
        <DriverMapMarker
          key={driver.id}
          name={driver.name}
          latitude={driver.latitude!}
          longitude={driver.longitude!}
          isSelected={selectedId === driver.id}
          isOnline={driver.isOnline}
          estimated={driver.estimated}
          motion={driver.motion}
          updatedAt={driver.updatedAt}
          showLabel={selectedId === driver.id || located.length <= 6}
          onSelect={() => onSelect(driver.id)}
        />
      ))}
      {geoDeliveries.map((delivery) => (
        <DeliveryOverviewMarker
          key={delivery.id}
          latitude={delivery.destination!.latitude}
          longitude={delivery.destination!.longitude}
          reference={delivery.reference}
          title={delivery.customerName ?? undefined}
          subtitle={delivery.address}
          status={getDispatchMapStatus(delivery)}
          showCallout={geoDeliveries.length <= 6}
          isSelected={selectedId === delivery.id}
          onSelect={() => onSelect(delivery.id)}
        />
      ))}
      {selectedDelivery?.pickups.map((pickup) => (
        <DeliveryPointMarker key={pickup.id} kind="pickup" latitude={pickup.latitude} longitude={pickup.longitude} label="Collecte" subtitle={pickup.address} />
      ))}
    </LeafletBaseMap>
  );
}
