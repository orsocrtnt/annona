"use client";

import { Fragment, useEffect, useMemo, useRef } from "react";
import L from "leaflet";
import { Marker, Polyline, Tooltip, useMap } from "react-leaflet";
import { LeafletBaseMap } from "@/components/maps/leaflet-base-map";
import type { TrackingMapProps } from "@/features/tracking/tracking-map";
import { timeLabel } from "@/lib/format/delivery-date";
import { MAP_VISUAL_THEME } from "@/lib/maps/map-visual-theme";
import { fr } from "@/lib/i18n/fr";

const t = fr.tracking;

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]!);
}

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).map((part) => part[0]!.toUpperCase()).slice(0, 2).join("") || "?";
}

function driverIcon(name: string, color: string, selected: boolean, stale: boolean) {
  const size = selected ? 38 : 32;
  return L.divIcon({
    className: "",
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    html: `<span style="display:flex;width:${size}px;height:${size}px;align-items:center;justify-content:center;border-radius:9999px;background:${color};color:#fff;border:3px solid #fff;font:700 12px/1 system-ui,sans-serif;box-shadow:0 0 0 ${selected ? 3 : 1}px ${MAP_VISUAL_THEME.ink};opacity:${stale ? 0.55 : 1}">${escapeHtml(initials(name))}</span>`,
  });
}

function stopIcon(label: string, color: string, dimmed: boolean) {
  return L.divIcon({
    className: "",
    iconSize: [24, 24],
    iconAnchor: [12, 12],
    html: `<span style="display:flex;width:24px;height:24px;align-items:center;justify-content:center;border-radius:9999px;background:#fff;color:${color};border:2px solid ${color};font:700 11px/1 system-ui,sans-serif;opacity:${dimmed ? 0.45 : 1}">${escapeHtml(label)}</span>`,
  });
}

const depotIcon = L.divIcon({
  className: "",
  iconSize: [26, 26],
  iconAnchor: [13, 13],
  html: `<span style="display:flex;width:26px;height:26px;align-items:center;justify-content:center;border-radius:8px;background:${MAP_VISUAL_THEME.ink};color:#fff;border:2px solid #fff;font:700 12px/1 system-ui,sans-serif">L</span>`,
});

/** Cadre la carte au premier affichage, puis sur le livreur choisi (sans suivre chaque rafraîchissement). */
function Framing({ points, focus }: { points: Array<[number, number]>; focus: Array<[number, number]> | null }) {
  const map = useMap();
  const framed = useRef(false);
  const focusKey = focus?.map((point) => point.join(",")).join(";") ?? "";
  useEffect(() => {
    if (framed.current || points.length === 0) return;
    framed.current = true;
    if (points.length === 1) map.setView(points[0]!, 14, { animate: false });
    else map.fitBounds(L.latLngBounds(points), { padding: [32, 32], animate: false, maxZoom: 15 });
  }, [map, points]);
  useEffect(() => {
    if (!focus || focus.length === 0) return;
    if (focus.length === 1) map.setView(focus[0]!, Math.max(map.getZoom(), 14));
    else map.fitBounds(L.latLngBounds(focus), { padding: [48, 48], maxZoom: 15 });
    // Recadrage seulement quand le livreur choisi change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, focusKey.split(";")[0]]);
  return null;
}

export function TrackingMapInner({ tracking, selectedRoundId, onSelect, colorOf, height = 460 }: TrackingMapProps) {
  const { depot, drivers } = tracking;
  const points = useMemo(() => {
    const all: Array<[number, number]> = [];
    if (depot) all.push([depot.latitude, depot.longitude]);
    for (const driver of drivers) {
      if (driver.position) all.push([driver.position.latitude, driver.position.longitude]);
      for (const point of driver.route.waypoints) all.push([point.latitude, point.longitude]);
    }
    return all;
  }, [depot, drivers]);
  const selected = drivers.find((driver) => driver.roundId === selectedRoundId) ?? null;
  const focus = selected
    ? (selected.position ? [[selected.position.latitude, selected.position.longitude] as [number, number]] : []).concat(
        selected.route.waypoints.slice(selected.position ? 1 : 0).map((point) => [point.latitude, point.longitude] as [number, number])
      )
    : null;

  return (
    <LeafletBaseMap height={height} center={depot ? [depot.latitude, depot.longitude] : undefined} zoom={12} variant="default">
      <Framing points={points} focus={focus} />
      {depot ? (
        <Marker position={[depot.latitude, depot.longitude]} icon={depotIcon} keyboard={false}>
          <Tooltip>{fr.rounds.depot}</Tooltip>
        </Marker>
      ) : null}
      {drivers.map((driver) => {
        const color = colorOf(driver.roundId);
        const dimmed = selectedRoundId !== null && selectedRoundId !== driver.roundId;
        const stops = driver.route.waypoints.slice(1);
        return (
          <Fragment key={driver.roundId}>
            {driver.route.polyline ? (
              <Polyline
                positions={driver.route.polyline}
                pathOptions={{ color, weight: dimmed ? 3 : 5, opacity: dimmed ? 0.35 : 0.9, dashArray: driver.route.approximate ? "6 8" : undefined }}
              />
            ) : null}
            {stops.map((point, index) => (
              <Marker key={`${driver.roundId}-${index}`} position={[point.latitude, point.longitude]} icon={stopIcon(String(index + 1), color, dimmed)} keyboard={false}>
                <Tooltip>{driver.driverName} · {index + 1}. {point.label}</Tooltip>
              </Marker>
            ))}
            {driver.position ? (
              <Marker
                position={[driver.position.latitude, driver.position.longitude]}
                icon={driverIcon(driver.driverName, color, driver.roundId === selectedRoundId, driver.position.stale)}
                zIndexOffset={1000}
                eventHandlers={{ click: () => onSelect(driver.roundId) }}
              >
                <Tooltip>
                  {driver.driverName} · {driver.position.stale ? t.lastKnown(timeLabel(driver.position.updatedAt)) : t.positionAt(timeLabel(driver.position.updatedAt))}
                </Tooltip>
              </Marker>
            ) : null}
          </Fragment>
        );
      })}
    </LeafletBaseMap>
  );
}
