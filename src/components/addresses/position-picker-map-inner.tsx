"use client";

import { useEffect, useMemo } from "react";
import L from "leaflet";
import { Marker, useMap, useMapEvents } from "react-leaflet";
import { LeafletBaseMap } from "@/components/maps/leaflet-base-map";
import { MAP_TILES } from "@/lib/maps/provider-config";

export interface PickerPosition {
  latitude: number;
  longitude: number;
}

function Recenter({ position }: { position: PickerPosition }) {
  const map = useMap();
  useEffect(() => {
    map.setView([position.latitude, position.longitude], Math.max(map.getZoom(), Math.min(16, MAP_TILES.maxZoom)), { animate: true });
  }, [position.latitude, position.longitude, map]);
  return null;
}

function ClickToMove({ onChange }: { onChange: (position: PickerPosition) => void }) {
  useMapEvents({
    click(event) {
      onChange({ latitude: event.latlng.lat, longitude: event.latlng.lng });
    },
  });
  return null;
}

/** ADM-1 : position du client (livraison), déplaçable en glissant le repère ou en cliquant sur la carte. */
export function PositionPickerMapInner({ position, onChange }: { position: PickerPosition; onChange: (position: PickerPosition) => void }) {
  const icon = useMemo(
    () =>
      L.divIcon({
        className: "",
        html: '<div style="width:22px;height:22px;border-radius:9999px;background:#0e1310;border:3px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.4)"></div>',
        iconSize: [22, 22],
        iconAnchor: [11, 11],
      }),
    []
  );
  return (
    <LeafletBaseMap height="100%" center={[position.latitude, position.longitude]} zoom={16}>
      <Recenter position={position} />
      <ClickToMove onChange={onChange} />
      <Marker
        position={[position.latitude, position.longitude]}
        draggable
        icon={icon}
        keyboard={false}
        eventHandlers={{
          dragend(event) {
            const latLng = (event.target as L.Marker).getLatLng();
            onChange({ latitude: latLng.lat, longitude: latLng.lng });
          },
        }}
      />
    </LeafletBaseMap>
  );
}
