"use client";

import { useEffect, useMemo } from "react";
import { CircleMarker, Popup, useMap } from "react-leaflet";
import type { DispatchMapPointKind } from "@/domains/delivery/dispatch-map.service";
import { LeafletBaseMap, PARIS_CENTER } from "@/components/maps/leaflet-base-map";
import { MAP_VISUAL_THEME } from "@/lib/maps/map-visual-theme";

export interface DispatchLeafletMarker {
  id: string;
  latitude: number;
  longitude: number;
  kind: DispatchMapPointKind;
  label: string;
  popupHtml: string;
}

interface DispatchLeafletMapProps {
  markers: DispatchLeafletMarker[];
  selectedId?: string | null;
  onSelect?: (id: string) => void;
  height?: number;
  emptyMessage?: string;
}

const MARKER_STYLE: Record<
  DispatchMapPointKind,
  { radius: number; color: string; fill: string; weight: number }
> = {
  destination: { radius: 8, color: MAP_VISUAL_THEME.surface, fill: MAP_VISUAL_THEME.ink, weight: 3 },
  pickup: { radius: 7, color: MAP_VISUAL_THEME.ink, fill: MAP_VISUAL_THEME.surface, weight: 2 },
  driver: { radius: 10, color: MAP_VISUAL_THEME.surface, fill: MAP_VISUAL_THEME.inkSoft, weight: 3 },
};

function MapViewController({
  markers,
  selectedId,
}: {
  markers: DispatchLeafletMarker[];
  selectedId?: string | null;
}) {
  const map = useMap();

  useEffect(() => {
    if (selectedId) {
      const selected = markers.find((m) => m.id === selectedId);
      if (selected) {
        map.setView([selected.latitude, selected.longitude], 14);
        map.invalidateSize();
        return;
      }
    }
    if (markers.length === 1) {
      const m = markers[0]!;
      map.setView([m.latitude, m.longitude], 13);
    } else if (markers.length > 1) {
      const lats = markers.map((m) => m.latitude);
      const lngs = markers.map((m) => m.longitude);
      map.fitBounds(
        [
          [Math.min(...lats), Math.min(...lngs)],
          [Math.max(...lats), Math.max(...lngs)],
        ],
        { padding: [40, 40], maxZoom: 14 }
      );
    } else {
      map.setView(PARIS_CENTER, 11);
    }
    map.invalidateSize();
  }, [markers, selectedId, map]);

  return null;
}

export function DispatchLeafletMap({
  markers,
  selectedId,
  onSelect,
  height = 560,
  emptyMessage = "Aucun point à afficher sur la carte",
}: DispatchLeafletMapProps) {
  const markerList = useMemo(() => markers, [markers]);

  return (
    <div className="relative w-full">
      <LeafletBaseMap
        height={height}
        zoom={11}
        className="overflow-hidden rounded-xl border border-border"
      >
        <MapViewController markers={markerList} selectedId={selectedId} />
        {markerList.map((marker) => {
          const style = MARKER_STYLE[marker.kind];
          const isSelected = selectedId === marker.id;
          return (
            <CircleMarker
              key={marker.id}
              center={[marker.latitude, marker.longitude]}
              radius={isSelected ? style.radius + 3 : style.radius}
              pathOptions={{
                color: isSelected ? MAP_VISUAL_THEME.ink : style.color,
                fillColor: style.fill,
                fillOpacity: 1,
                weight: isSelected ? style.weight + 2 : style.weight,
              }}
              eventHandlers={{
                click: () => onSelect?.(marker.id),
              }}
            >
              <Popup>
                <span dangerouslySetInnerHTML={{ __html: marker.popupHtml }} />
              </Popup>
            </CircleMarker>
          );
        })}
      </LeafletBaseMap>
      {markers.length === 0 && (
        <div className="pointer-events-none absolute inset-x-0 top-4 z-[1000] flex justify-center px-4">
          <p className="rounded-full bg-white/95 px-4 py-2 text-center text-sm text-muted-foreground shadow-md">
            {emptyMessage}
          </p>
        </div>
      )}
    </div>
  );
}
