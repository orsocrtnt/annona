"use client";

import { useEffect, useMemo, useRef } from "react";
import L from "leaflet";
import { Marker, Polyline, useMap, useMapEvents } from "react-leaflet";
import { LeafletBaseMap } from "@/components/maps/leaflet-base-map";
import type { NavigationRoute } from "@/lib/maps/osrm-route";
import type { LivePosition } from "@/features/driver/use-driver-live-position";

type DriverNavigationMapProps = {
  position: LivePosition | null;
  heading: number | null;
  target: { latitude: number; longitude: number; label: string } | null;
  route: NavigationRoute | null;
  followDriver: boolean;
  onUserInteraction: () => void;
};

const NAV_ZOOM = 18;

function MapNavigationFollow({
  position,
  heading,
  followDriver,
}: {
  position: LivePosition | null;
  heading: number | null;
  followDriver: boolean;
}) {
  const map = useMap();
  const initialized = useRef(false);

  useEffect(() => {
    if (!followDriver || !position) return;

    const latlng = L.latLng(position.latitude, position.longitude);
    const zoom = initialized.current ? map.getZoom() : NAV_ZOOM;
    const size = map.getSize();
    const projected = map.project(latlng, zoom);

    const offsetY = size.y * 0.24;
    const offsetPoint = L.point(projected.x, projected.y + offsetY);
    const center = map.unproject(offsetPoint, zoom);

    map.setView(center, Math.max(zoom, NAV_ZOOM), {
      animate: initialized.current,
      duration: 0.35,
    });

    initialized.current = true;
  }, [followDriver, heading, map, position?.latitude, position?.longitude]);

  return null;
}

function MapInteractionWatcher({ onUserInteraction }: { onUserInteraction: () => void }) {
  useMapEvents({
    dragstart: onUserInteraction,
    zoomstart: onUserInteraction,
  });
  return null;
}

function createDriverIcon(heading: number | null) {
  const rotation = heading ?? 0;
  return L.divIcon({
    className: "driver-nav-arrow",
    html: `<div style="
      width: 28px;
      height: 28px;
      transform: rotate(${rotation}deg);
      transform-origin: center center;
    ">
      <svg viewBox="0 0 24 24" width="28" height="28" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="12" cy="12" r="10" fill="#2563eb" stroke="#ffffff" stroke-width="2.5"/>
        <path d="M12 6 L16 16 L12 13 L8 16 Z" fill="#ffffff"/>
      </svg>
    </div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  });
}

export function DriverNavigationMap({
  position,
  heading,
  target,
  route,
  followDriver,
  onUserInteraction,
}: DriverNavigationMapProps) {
  const center = useMemo<[number, number]>(() => {
    if (position) return [position.latitude, position.longitude];
    if (target) return [target.latitude, target.longitude];
    return [48.8566, 2.3522];
  }, [position, target]);

  const driverIcon = useMemo(() => createDriverIcon(heading), [heading]);

  return (
    <LeafletBaseMap fill variant="uber" center={center} zoom={NAV_ZOOM} className="h-full w-full">
      <MapInteractionWatcher onUserInteraction={onUserInteraction} />
      <MapNavigationFollow position={position} heading={heading} followDriver={followDriver} />

      {route && route.polyline.length > 1 && (
        <>
          <Polyline
            positions={route.polyline}
            pathOptions={{ color: "#93c5fd", weight: 10, opacity: 0.55, lineCap: "round" }}
          />
          <Polyline
            positions={route.polyline}
            pathOptions={{ color: "#2563eb", weight: 6, opacity: 0.95, lineCap: "round" }}
          />
        </>
      )}

      {target && (
        <Marker
          position={[target.latitude, target.longitude]}
          icon={L.divIcon({
            className: "",
            html: `<div style="
              width: 18px; height: 18px; border-radius: 9999px;
              background: #ea580c; border: 3px solid white;
              box-shadow: 0 2px 8px rgba(0,0,0,0.25);
            "></div>`,
            iconSize: [18, 18],
            iconAnchor: [9, 9],
          })}
        />
      )}

      {position && (
        <Marker position={[position.latitude, position.longitude]} icon={driverIcon} zIndexOffset={1000} />
      )}
    </LeafletBaseMap>
  );
}
