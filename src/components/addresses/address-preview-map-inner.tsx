"use client";

import { useEffect } from "react";
import { CircleMarker, useMap } from "react-leaflet";
import { LeafletBaseMap } from "@/components/maps/leaflet-base-map";
import { MAP_TILES } from "@/lib/maps/provider-config";
import { MAP_VISUAL_THEME } from "@/lib/maps/map-visual-theme";

function RecenterMap({ latitude, longitude }: { latitude: number; longitude: number }) {
  const map = useMap();

  useEffect(() => {
    map.setView([latitude, longitude], Math.min(16, MAP_TILES.maxZoom), { animate: true });
  }, [latitude, longitude, map]);

  return null;
}

export function AddressPreviewMapInner({
  latitude,
  longitude,
}: {
  latitude: number;
  longitude: number;
}) {
  return (
    <LeafletBaseMap height="100%" center={[latitude, longitude]} zoom={16}>
      <RecenterMap latitude={latitude} longitude={longitude} />
      <CircleMarker
        center={[latitude, longitude]}
        radius={10}
        pathOptions={{
          color: MAP_VISUAL_THEME.surface,
          fillColor: MAP_VISUAL_THEME.ink,
          fillOpacity: 1,
          weight: 3,
        }}
      />
    </LeafletBaseMap>
  );
}
