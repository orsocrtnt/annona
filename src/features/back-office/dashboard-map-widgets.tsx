"use client";

import { useMemo } from "react";
import dynamic from "next/dynamic";
import type { DispatchLeafletMarker } from "@/components/maps/dispatch-leaflet-map";
import type { DispatchMapPointKind } from "@/domains/delivery/dispatch-map.service";
import { useDispatchDeliveriesMap, useDriverLiveLocations } from "@/features/back-office/dispatch-map-hooks";

// Leaflet children also access window at import time, before the base map renders.
const DriversLiveMap = dynamic(
  () => import("@/components/maps/drivers-live-map").then((module) => module.DriversLiveMap),
  { ssr: false }
);
const DispatchLeafletMap = dynamic(
  () => import("@/components/maps/dispatch-leaflet-map").then((module) => module.DispatchLeafletMap),
  { ssr: false }
);

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function buildMarkerPopup(label: string, reference: string, address: string) {
  return `<strong>${escapeHtml(reference)}</strong><br/>${escapeHtml(label)}<br/><span style="color:#64748b">${escapeHtml(address)}</span>`;
}

function toLeafletMarkers(
  points: {
    id: string;
    kind: DispatchMapPointKind;
    latitude: number;
    longitude: number;
    reference: string;
    label: string;
    address: string;
  }[]
): DispatchLeafletMarker[] {
  return points.map((point) => ({
    id: point.id,
    latitude: point.latitude,
    longitude: point.longitude,
    kind: point.kind,
    label: point.label,
    popupHtml: buildMarkerPopup(point.label, point.reference, point.address),
  }));
}

export function DriversMapWidget({ height = 280 }: { height?: number }) {
  const { data: drivers, isError, error } = useDriverLiveLocations();
  const list = drivers ?? [];

  return (
    <div className="space-y-2">
      {isError && (
        <p className="text-sm text-destructive">
          {error instanceof Error ? error.message : "Erreur de chargement"}
        </p>
      )}
      <div className="relative w-full overflow-hidden rounded-xl border border-border">
        <DriversLiveMap drivers={list} height={height} />
      </div>
      <p className="text-xs text-muted-foreground">
        {list.filter((d) => d.isOnline).length} connecté
        {list.filter((d) => d.isOnline).length > 1 ? "s" : ""} ·{" "}
        {list.filter((d) => d.latitude != null).length} localisé
        {list.filter((d) => d.latitude != null).length > 1 ? "s" : ""}
      </p>
    </div>
  );
}

export function DeliveriesMapWidget({ height = 280 }: { height?: number }) {
  const { data, isError, error } = useDispatchDeliveriesMap();
  const markers = useMemo(
    () => toLeafletMarkers(data?.points ?? []),
    [data?.points]
  );

  return (
    <div className="space-y-2">
      {isError && (
        <p className="text-sm text-destructive">
          {error instanceof Error ? error.message : "Erreur de chargement"}
        </p>
      )}
      <DispatchLeafletMap
        markers={markers}
        height={height}
        emptyMessage="Aucune mission active à afficher"
      />
      <p className="text-xs text-muted-foreground">
        {data?.deliveries.length ?? 0} mission
        {(data?.deliveries.length ?? 0) > 1 ? "s" : ""} active
        {(data?.deliveries.length ?? 0) > 1 ? "s" : ""}
      </p>
    </div>
  );
}
