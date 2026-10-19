"use client";

import { useEffect } from "react";
import { CircleMarker, Polyline, Popup, useMap } from "react-leaflet";
import { LeafletBaseMap } from "@/components/maps/leaflet-base-map";
import { MAP_ROUTE_STYLE, MAP_VISUAL_THEME } from "@/lib/maps/map-visual-theme";

export interface MapMarker {
  id: string;
  label: string;
  latitude: number;
  longitude: number;
}

export interface DeliveryMapProps {
  markers: MapMarker[];
  className?: string;
}

function DeliveryMapPoints({ markers }: { markers: MapMarker[] }) {
  const map = useMap();
  useEffect(() => {
    if (markers.length > 1) map.fitBounds(markers.map(m => [m.latitude, m.longitude] as [number, number]), { padding: [30, 30], maxZoom: 15 });
  }, [map, markers]);
  return <>
    {markers.length > 1 && <Polyline positions={markers.map(m => [m.latitude, m.longitude])} pathOptions={{ ...MAP_ROUTE_STYLE.halo, weight: 7 }} />}
    {markers.length > 1 && <Polyline positions={markers.map(m => [m.latitude, m.longitude])} pathOptions={{ ...MAP_ROUTE_STYLE.line, weight: 3.5 }} />}
    {markers.map((marker, index) => <CircleMarker key={marker.id} center={[marker.latitude, marker.longitude]} radius={index === markers.length - 1 ? 9 : 6} pathOptions={{ color: MAP_VISUAL_THEME.surface, fillColor: index === markers.length - 1 ? MAP_VISUAL_THEME.ink : MAP_VISUAL_THEME.inkSoft, fillOpacity: 1, weight: 3 }}><Popup>{marker.label}</Popup></CircleMarker>)}
  </>;
}

export function DeliveryMapInner({ markers, className }: DeliveryMapProps) {
  if (!markers.length) return <div className={`flex h-64 items-center justify-center rounded-xl border bg-muted/30 text-sm text-muted-foreground ${className ?? ""}`}>Carte indisponible — aucune position enregistrée</div>;
  const last = markers[markers.length - 1]!;
  return <LeafletBaseMap height={256} center={[last.latitude, last.longitude]} zoom={13} className={`overflow-hidden rounded-xl border ${className ?? ""}`}><DeliveryMapPoints markers={markers} /></LeafletBaseMap>;
}
