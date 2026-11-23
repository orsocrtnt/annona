"use client";

import { Fragment, useEffect, useMemo } from "react";
import L from "leaflet";
import { Marker, Polyline, Tooltip, useMap } from "react-leaflet";
import { LeafletBaseMap } from "@/components/maps/leaflet-base-map";
import type { DeliveryMapInnerProps, DeliveryMapRound } from "@/features/delivery-map/delivery-map";
import { MAP_VISUAL_THEME } from "@/lib/maps/map-visual-theme";
import { fr } from "@/lib/i18n/fr";

const t = fr.deliveryMap;

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]!);
}

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).map((part) => part[0]!.toUpperCase()).slice(0, 2).join("") || "?";
}

/** À livrer : numéro de passage, liseré couleur de la tournée. */
function nextIcon(label: string, color: string) {
  return L.divIcon({
    className: "",
    iconSize: [24, 24],
    iconAnchor: [12, 12],
    html: `<span style="display:flex;width:24px;height:24px;align-items:center;justify-content:center;border-radius:9999px;background:#fff;color:${color};border:2px solid ${color};font:700 11px/1 system-ui,sans-serif;box-shadow:0 1px 2px rgba(0,0,0,.25)">${escapeHtml(label)}</span>`,
  });
}

/** Livré : petit point gris, sans numéro (ce qui reste à faire ressort). */
const deliveredIcon = L.divIcon({
  className: "",
  iconSize: [12, 12],
  iconAnchor: [6, 6],
  html: `<span style="display:block;width:12px;height:12px;border-radius:9999px;background:#a1a1aa;border:2px solid #fff"></span>`,
});

const incidentIcon = L.divIcon({
  className: "",
  iconSize: [22, 22],
  iconAnchor: [11, 11],
  html: `<span style="display:flex;width:22px;height:22px;align-items:center;justify-content:center;border-radius:9999px;background:${MAP_VISUAL_THEME.danger};color:#fff;border:2px solid #fff;font:800 12px/1 system-ui,sans-serif">!</span>`,
});

const depotIcon = L.divIcon({
  className: "",
  iconSize: [28, 28],
  iconAnchor: [14, 14],
  html: `<span style="display:flex;width:28px;height:28px;align-items:center;justify-content:center;border-radius:8px;background:${MAP_VISUAL_THEME.ink};color:#fff;border:2px solid #fff;font:700 13px/1 system-ui,sans-serif">L</span>`,
});

function driverIcon(name: string, color: string, stale: boolean) {
  return L.divIcon({
    className: "",
    iconSize: [36, 36],
    iconAnchor: [18, 18],
    html: `<span style="display:flex;width:36px;height:36px;align-items:center;justify-content:center;border-radius:9999px;background:${color};color:#fff;border:3px solid #fff;font:700 12px/1 system-ui,sans-serif;box-shadow:0 0 0 2px ${MAP_VISUAL_THEME.ink},0 2px 6px rgba(0,0,0,.3);opacity:${stale ? 0.55 : 1}">${escapeHtml(initials(name))}</span>`,
  });
}

function located(round: DeliveryMapRound) {
  return round.stops.filter((stop) => stop.latitude !== null && stop.longitude !== null);
}

/** Recadre sur les tournées affichées quand le choix change (pas à chaque actualisation des positions). */
function Framing({ rounds, depot }: Pick<DeliveryMapInnerProps, "rounds" | "depot">) {
  const map = useMap();
  const key = rounds.map((round) => round.id).join(",");
  useEffect(() => {
    const points: Array<[number, number]> = [];
    for (const round of rounds) {
      for (const stop of located(round)) points.push([stop.latitude!, stop.longitude!]);
      if (round.driverPosition) points.push([round.driverPosition.latitude, round.driverPosition.longitude]);
    }
    if (points.length === 0 && depot) points.push([depot.latitude, depot.longitude]);
    if (points.length === 0) return;
    if (points.length === 1) map.setView(points[0]!, 14, { animate: false });
    else map.fitBounds(L.latLngBounds(points), { padding: [36, 36], animate: false, maxZoom: 15 });
    // Recadrage seulement quand les tournées affichées changent.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, key]);
  return null;
}

export function DeliveryMapInner({ depot, rounds, height, onDriverClick }: DeliveryMapInnerProps) {
  const drawn = useMemo(
    () =>
      rounds.map((round) => {
        const stops = located(round);
        // Ordre de passage : laboratoire puis arrêts ; trait fin, le trajet calculé du livreur est plus épais.
        const planned: Array<[number, number]> = [
          ...(depot ? [[depot.latitude, depot.longitude] as [number, number]] : []),
          ...stops.map((stop) => [stop.latitude!, stop.longitude!] as [number, number]),
        ];
        return { round, stops, planned };
      }),
    [rounds, depot],
  );

  return (
    <LeafletBaseMap height={height} center={depot ? [depot.latitude, depot.longitude] : undefined} zoom={12} variant="default">
      <Framing rounds={rounds} depot={depot} />
      {depot ? (
        <Marker position={[depot.latitude, depot.longitude]} icon={depotIcon} keyboard={false}>
          <Tooltip>{fr.rounds.depot}</Tooltip>
        </Marker>
      ) : null}
      {drawn.map(({ round, stops, planned }) => (
        <Fragment key={round.id}>
          {planned.length > 1 ? (
            <Polyline positions={planned} pathOptions={{ color: round.color, weight: 2.5, opacity: 0.5 }} />
          ) : null}
          {round.route?.polyline ? (
            <Polyline
              positions={round.route.polyline}
              pathOptions={{ color: round.color, weight: 5, opacity: 0.95, dashArray: round.route.approximate ? "6 8" : undefined }}
            />
          ) : null}
          {stops.map((stop) => (
            <Marker
              key={stop.id}
              position={[stop.latitude!, stop.longitude!]}
              icon={stop.status === "DELIVERED" ? deliveredIcon : stop.status === "INCIDENT" ? incidentIcon : nextIcon(String(stop.sequence), round.color)}
              zIndexOffset={stop.status === "DELIVERED" ? -100 : 0}
              keyboard={false}
            >
              <Tooltip>{t.stopTooltip(round.name, stop.sequence, stop.merchantName, t.stopStatus[stop.status] ?? stop.status)}</Tooltip>
            </Marker>
          ))}
          {round.driverPosition ? (
            <Marker
              position={[round.driverPosition.latitude, round.driverPosition.longitude]}
              icon={driverIcon(round.driverName ?? round.name, round.color, Boolean(round.driverPosition.stale))}
              zIndexOffset={1000}
              eventHandlers={onDriverClick ? { click: () => onDriverClick(round.id) } : undefined}
            >
              <Tooltip>
                {round.driverName ?? round.name} · {round.name}
              </Tooltip>
            </Marker>
          ) : null}
        </Fragment>
      ))}
    </LeafletBaseMap>
  );
}
