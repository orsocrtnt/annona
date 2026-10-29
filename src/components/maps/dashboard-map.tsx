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
import { isLocatedDriver, locatedDeliveries, type DashboardMapView } from "@/features/back-office/dashboard-map-model";

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
  const lastFit = useRef("");
  const pointsRef = useRef(points);
  pointsRef.current = points;

  useEffect(() => {
    const target = selectedRef.current;
    if (selectedId && target) {
      // Recentrage seulement quand la sélection change : un nouveau relevé GPS ne déplace pas la carte.
      if (lastSelectedId.current !== selectedId) {
        lastSelectedId.current = selectedId;
        map.setView(target, Math.max(map.getZoom(), 14), { animate: true });
      }
      return;
    }
    lastSelectedId.current = null;
    if (lastFit.current === fitKey) return;
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
  }, [map, selectedId, fitKey, selected !== null]);

  return null;
}

export function DashboardMap({ view, drivers, deliveries, selectedId, onSelect, height }: Props) {
  const located = useMemo(() => drivers.filter(isLocatedDriver), [drivers]);
  const geoDeliveries = useMemo(() => locatedDeliveries(deliveries), [deliveries]);
  const selectedDelivery = view === "deliveries" ? geoDeliveries.find((d) => d.id === selectedId) : undefined;

  const points = useMemo<[number, number][]>(
    () =>
      view === "drivers"
        ? located.map((d) => [d.latitude!, d.longitude!])
        : geoDeliveries.map((d) => [d.destination!.latitude, d.destination!.longitude]),
    [view, located, geoDeliveries]
  );
  const selectedPoint = useMemo<[number, number] | null>(() => {
    if (view === "drivers") {
      const driver = located.find((d) => d.id === selectedId);
      return driver ? [driver.latitude!, driver.longitude!] : null;
    }
    return selectedDelivery?.destination ? [selectedDelivery.destination.latitude, selectedDelivery.destination.longitude] : null;
  }, [view, located, selectedId, selectedDelivery]);
  const fitKey = `${view}:${points.map((p) => p.join(",")).sort().join("|")}`;
  // Le cadrage ne dépend que des identifiants affichés, pas des positions qui bougent.
  const stableFitKey = view === "drivers" ? `${view}:${located.map((d) => d.id).sort().join("|")}` : fitKey;

  return (
    <LeafletBaseMap height={height} variant="uber" zoom={11} className="w-full">
      <SceneView points={points} selected={selectedPoint} selectedId={selectedId} fitKey={stableFitKey} />
      {view === "drivers" &&
        located.map((driver) => (
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
      {view === "deliveries" &&
        geoDeliveries.map((delivery) => (
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
