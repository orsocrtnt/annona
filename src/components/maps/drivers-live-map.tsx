"use client";

import { useEffect, useMemo, useRef } from "react";
import { useMap } from "react-leaflet";
import L from "leaflet";
import type { Map as LeafletMap } from "leaflet";
import type { LiveDriverLocation } from "@/domains/driver/driver-location.service";
import { DriverMapMarker } from "@/components/maps/driver-map-marker";
import { LeafletBaseMap, PARIS_CENTER } from "@/components/maps/leaflet-base-map";
import { useUIStore } from "@/stores/ui.store";

export type DriversMapApi = {
  zoomIn: () => void;
  zoomOut: () => void;
};

interface DriversLiveMapProps {
  drivers: LiveDriverLocation[];
  selectedId?: string | null;
  onSelect?: (id: string) => void;
  onMapReady?: (api: DriversMapApi) => void;
  /** Hauteur fixe pour les widgets embarqués (désactive le mode plein écran). */
  height?: number;
}

function MapApiBridge({ onMapReady }: { onMapReady?: (api: DriversMapApi) => void }) {
  const map = useMap();

  useEffect(() => {
    onMapReady?.({
      zoomIn: () => map.zoomIn(),
      zoomOut: () => map.zoomOut(),
    });
  }, [map, onMapReady]);

  return null;
}

const FIT_RETRY_DELAYS = {
  embedded: [50, 200, 400],
  fullscreen: [50, 150, 320, 500, 800],
} as const;

const FIT_OPTIONS = {
  embedded: { padding: [32, 32] as [number, number], maxZoom: 15, singleZoom: 14 },
  fullscreen: { padding: [80, 80] as [number, number], maxZoom: 14, singleZoom: 14 },
} as const;

function driversFitKey(located: LiveDriverLocation[]) {
  return located
    .map((d) => `${d.id}:${d.latitude?.toFixed(5)},${d.longitude?.toFixed(5)}`)
    .join("|");
}

function fitMapToDrivers(
  map: LeafletMap,
  located: LiveDriverLocation[],
  options: { padding: [number, number]; maxZoom: number; singleZoom: number }
) {
  if (located.length === 0) {
    map.setView(PARIS_CENTER, 12);
    return;
  }

  if (located.length === 1) {
    const driver = located[0]!;
    map.setView([driver.latitude!, driver.longitude!], options.singleZoom);
    return;
  }

  const bounds = L.latLngBounds(
    located.map((d) => [d.latitude!, d.longitude!] as [number, number])
  );

  map.fitBounds(bounds, {
    padding: options.padding,
    maxZoom: options.maxZoom,
    animate: false,
  });
}

function MapViewController({
  drivers,
  selectedId,
  embedded = false,
}: {
  drivers: LiveDriverLocation[];
  selectedId?: string | null;
  embedded?: boolean;
}) {
  const map = useMap();
  const sidebarCollapsed = useUIStore((s) => s.sidebarCollapsed);
  const located = useMemo(
    () => drivers.filter((d) => d.latitude != null && d.longitude != null),
    [drivers]
  );
  const userHasMovedMap = useRef(false);
  const programmaticMove = useRef(false);
  const prevSelectedId = useRef<string | null | undefined>(undefined);
  const prevFitKey = useRef("");

  const fitOptions = embedded ? FIT_OPTIONS.embedded : FIT_OPTIONS.fullscreen;
  const fitRetryDelays = embedded ? FIT_RETRY_DELAYS.embedded : FIT_RETRY_DELAYS.fullscreen;

  useEffect(() => {
    const markUserMove = () => {
      if (programmaticMove.current) return;
      userHasMovedMap.current = true;
    };
    map.on("zoomend", markUserMove);
    map.on("dragend", markUserMove);
    return () => {
      map.off("zoomend", markUserMove);
      map.off("dragend", markUserMove);
    };
  }, [map]);

  useEffect(() => {
    if (selectedId !== prevSelectedId.current) {
      prevSelectedId.current = selectedId;
      if (selectedId) {
        const selected = located.find((d) => d.id === selectedId);
        if (selected) {
          programmaticMove.current = true;
          map.setView([selected.latitude!, selected.longitude!], 15, { animate: true });
          window.requestAnimationFrame(() => {
            programmaticMove.current = false;
          });
        }
      }
    }
    map.invalidateSize();
  }, [selectedId, located, map]);

  useEffect(() => {
    if (selectedId || userHasMovedMap.current) return;

    const fitKey =
      driversFitKey(located) + (embedded ? "" : `:sb-${sidebarCollapsed ? "c" : "e"}`);
    if (fitKey === prevFitKey.current) return;
    prevFitKey.current = fitKey;

    const applyFit = () => {
      programmaticMove.current = true;
      map.invalidateSize({ animate: false });
      fitMapToDrivers(map, located, fitOptions);
      window.requestAnimationFrame(() => {
        map.invalidateSize({ animate: false });
        fitMapToDrivers(map, located, fitOptions);
        programmaticMove.current = false;
      });
    };

    if (located.length === 0) {
      programmaticMove.current = true;
      map.setView(PARIS_CENTER, 12);
      programmaticMove.current = false;
      return;
    }

    applyFit();
    const timers = fitRetryDelays.map((ms) => window.setTimeout(applyFit, ms));
    return () => timers.forEach((t) => window.clearTimeout(t));
  }, [
    embedded,
    fitOptions,
    fitRetryDelays,
    located,
    map,
    selectedId,
    sidebarCollapsed,
  ]);

  return null;
}

export function DriversLiveMap({
  drivers,
  selectedId,
  onSelect,
  onMapReady,
  height,
}: DriversLiveMapProps) {
  const located = useMemo(
    () => drivers.filter((d) => d.latitude != null && d.longitude != null),
    [drivers]
  );
  const embedded = height !== undefined;

  return (
    <LeafletBaseMap
      fill={!embedded}
      height={height ?? 600}
      variant="uber"
      className={embedded ? "w-full" : "h-full w-full"}
    >
      <MapApiBridge onMapReady={onMapReady} />
      <MapViewController drivers={drivers} selectedId={selectedId} embedded={embedded} />
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
          onSelect={() => onSelect?.(driver.id)}
        />
      ))}
    </LeafletBaseMap>
  );
}

