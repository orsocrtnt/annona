"use client";

import { useEffect, useRef } from "react";
import "leaflet/dist/leaflet.css";

export interface MapMarker {
  id: string;
  label: string;
  latitude: number;
  longitude: number;
}

interface DeliveryMapProps {
  markers: MapMarker[];
  className?: string;
}

export function DeliveryMap({ markers, className }: DeliveryMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<{ remove: () => void } | null>(null);

  useEffect(() => {
    if (!containerRef.current || markers.length === 0) return;

    let mounted = true;

    import("leaflet").then((L) => {
      if (!mounted || !containerRef.current) return;

      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }

      const last = markers[markers.length - 1]!;
      const map = L.map(containerRef.current).setView(
        [last.latitude, last.longitude],
        13
      );

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>',
      }).addTo(map);

      const bounds = L.latLngBounds([]);
      markers.forEach((marker, index) => {
        const isLast = index === markers.length - 1;
        L.circleMarker([marker.latitude, marker.longitude], {
          radius: isLast ? 10 : 7,
          color: isLast ? "#2563eb" : "#94a3b8",
          fillColor: isLast ? "#2563eb" : "#cbd5e1",
          fillOpacity: 0.9,
          weight: 2,
        })
          .addTo(map)
          .bindPopup(marker.label);
        bounds.extend([marker.latitude, marker.longitude]);
      });

      if (markers.length > 1) {
        const points = markers.map((m) => [m.latitude, m.longitude] as [number, number]);
        L.polyline(points, { color: "#2563eb", weight: 3, opacity: 0.7 }).addTo(map);
        map.fitBounds(bounds, { padding: [30, 30] });
      }

      mapRef.current = map;
    });

    return () => {
      mounted = false;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [markers]);

  if (markers.length === 0) {
    return (
      <div className={`flex h-64 items-center justify-center rounded-xl border border-border bg-muted/30 text-sm text-muted-foreground ${className ?? ""}`}>
        Carte indisponible — aucune position enregistrée
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={`h-64 w-full overflow-hidden rounded-xl border border-border ${className ?? ""}`}
    />
  );
}
