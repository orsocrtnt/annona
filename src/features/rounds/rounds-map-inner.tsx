"use client";

import { Fragment, useEffect, useMemo } from "react";
import L from "leaflet";
import { Marker, Polyline, Tooltip, useMap } from "react-leaflet";
import { LeafletBaseMap } from "@/components/maps/leaflet-base-map";
import type { RoundsMapProps } from "@/features/rounds/rounds-map";
import { MAP_VISUAL_THEME } from "@/lib/maps/map-visual-theme";
import { fr } from "@/lib/i18n/fr";

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]!);
}

function stopIcon(label: string, color: string, status: string, dimmed: boolean) {
  const done = status === "DELIVERED";
  const incident = status === "INCIDENT";
  const background = incident ? MAP_VISUAL_THEME.danger : done ? MAP_VISUAL_THEME.muted : color;
  return L.divIcon({
    className: "",
    iconSize: [26, 26],
    iconAnchor: [13, 13],
    html: `<span style="display:flex;width:26px;height:26px;align-items:center;justify-content:center;border-radius:9999px;background:${background};color:#fff;border:2px solid #fff;font:600 12px/1 system-ui,sans-serif;box-shadow:0 1px 3px rgba(0,0,0,.35);opacity:${dimmed ? 0.45 : 1}">${escapeHtml(label)}</span>`,
  });
}

const depotIcon = L.divIcon({
  className: "",
  iconSize: [28, 28],
  iconAnchor: [14, 14],
  html: `<span style="display:flex;width:28px;height:28px;align-items:center;justify-content:center;border-radius:8px;background:${MAP_VISUAL_THEME.ink};color:#fff;border:2px solid #fff;font:700 13px/1 system-ui,sans-serif">L</span>`,
});

const driverIcon = L.divIcon({
  className: "",
  iconSize: [22, 22],
  iconAnchor: [11, 11],
  html: `<span style="display:block;width:22px;height:22px;border-radius:9999px;background:${MAP_VISUAL_THEME.brand};border:3px solid #fff;box-shadow:0 0 0 2px ${MAP_VISUAL_THEME.ink}"></span>`,
});

function FitBounds({ points }: { points: Array<[number, number]> }) {
  const map = useMap();
  const key = points.map((point) => point.join(",")).join(";");
  useEffect(() => {
    if (points.length === 0) return;
    if (points.length === 1) {
      map.setView(points[0]!, 14, { animate: false });
      return;
    }
    map.fitBounds(L.latLngBounds(points), { padding: [32, 32], animate: false, maxZoom: 15 });
    // Les points ne changent que si la clé change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, key]);
  return null;
}

export function RoundsMapInner({ depot, rounds, selectedRoundId, height = 420 }: RoundsMapProps) {
  const points = useMemo(() => {
    const all: Array<[number, number]> = [];
    if (depot) all.push([depot.latitude, depot.longitude]);
    for (const round of rounds) {
      for (const stop of round.stops) if (stop.latitude !== null && stop.longitude !== null) all.push([stop.latitude, stop.longitude]);
      if (round.driverPosition) all.push([round.driverPosition.latitude, round.driverPosition.longitude]);
    }
    return all;
  }, [depot, rounds]);

  return (
    <LeafletBaseMap height={height} center={depot ? [depot.latitude, depot.longitude] : undefined} zoom={12} variant="default">
      <FitBounds points={points} />
      {depot ? (
        <Marker position={[depot.latitude, depot.longitude]} icon={depotIcon} keyboard={false}>
          <Tooltip>{fr.rounds.depot}</Tooltip>
        </Marker>
      ) : null}
      {rounds.map((round) => {
        const dimmed = selectedRoundId !== null && selectedRoundId !== round.id;
        const located = round.stops.filter((stop) => stop.latitude !== null && stop.longitude !== null);
        const line: Array<[number, number]> = [
          ...(depot ? [[depot.latitude, depot.longitude] as [number, number]] : []),
          ...located.map((stop) => [stop.latitude!, stop.longitude!] as [number, number]),
        ];
        return (
          <Fragment key={round.id}>
            {line.length > 1 ? (
              <Polyline positions={line} pathOptions={{ color: round.color, weight: dimmed ? 2 : 4, opacity: dimmed ? 0.35 : 0.85, dashArray: "6 6" }} />
            ) : null}
            {located.map((stop) => (
              <Marker key={stop.id} position={[stop.latitude!, stop.longitude!]} icon={stopIcon(String(stop.sequence), round.color, stop.status, dimmed)} keyboard={false}>
                <Tooltip>
                  {round.name} · {fr.rounds.stopNumber(stop.sequence)} · {stop.merchantName}
                </Tooltip>
              </Marker>
            ))}
            {round.driverPosition ? (
              <Marker position={[round.driverPosition.latitude, round.driverPosition.longitude]} icon={driverIcon} zIndexOffset={1000} keyboard={false}>
                <Tooltip>{round.driverName ?? round.name}</Tooltip>
              </Marker>
            ) : null}
          </Fragment>
        );
      })}
    </LeafletBaseMap>
  );
}
