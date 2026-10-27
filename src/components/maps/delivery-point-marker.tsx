"use client";

import { useMemo } from "react";
import L from "leaflet";
import { Marker } from "react-leaflet";
import type { DeliveryMapMarkerKind } from "@/features/back-office/dispatch-delivery-map-state";
import {
  getDispatchMapStatusMeta,
  type DispatchMapStatusKey,
} from "@/features/back-office/dispatch-map-status";
import { MAP_VISUAL_THEME } from "@/lib/maps/map-visual-theme";

/**
 * Clic sur un repère. Le double-clic est reconnu plus haut (deux clics rapprochés sur la même
 * livraison) : le repère cliqué peut être remplacé entre les deux clics, ce qui empêcherait
 * le navigateur d'émettre un événement « dblclick ».
 */
function useMarkerClicks(onClick?: () => void) {
  return useMemo(
    () => ({
      click: () => onClick?.(),
      keypress: (event: L.LeafletKeyboardEvent) => {
        if (event.originalEvent.key === "Enter") onClick?.();
      },
    }),
    [onClick]
  );
}

function escapeHtml(text: string) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const PILL_COLORS: Record<DispatchMapStatusKey, [string, string]> = {
  late: ["#fde3e0", "#b8352b"],
  unassigned: ["#fde9d6", "#a8560d"],
  pending: ["#e1ebfb", "#2a62bd"],
  route: ["#dff5e8", "#08783f"],
};

/** Épingle encre de la planche A ; le cœur prend la couleur de l'état (vert en route, rouge en retard). */
function pinSvg(size: number, core: string, muted: boolean) {
  const fill = muted ? MAP_VISUAL_THEME.muted : MAP_VISUAL_THEME.ink;
  return `<svg width="${size}" height="${Math.round(size * 1.25)}" viewBox="0 0 26 32" aria-hidden="true" style="display:block;filter:drop-shadow(0 4px 8px rgba(14,19,16,0.25))"><path d="M13 31s11-10.5 11-18A11 11 0 0 0 2 13c0 7.5 11 18 11 18z" fill="${fill}" stroke="#ffffff" stroke-width="1.5"/><circle cx="13" cy="13" r="4.6" fill="${core}"/></svg>`;
}

function calloutHtml(label: string, subtitle: string | undefined, status: DispatchMapStatusKey | undefined, offset: number) {
  const pill = status
    ? `<span style="justify-self:start;font-size:10.5px;font-weight:600;padding:2px 8px;border-radius:999px;background:${PILL_COLORS[status][0]};color:${PILL_COLORS[status][1]};">${getDispatchMapStatusMeta(status).label}</span>`
    : "";
  const sub = subtitle
    ? `<span style="font-size:10.5px;color:#68726b;max-width:170px;white-space:normal;line-height:1.3;">${escapeHtml(subtitle)}</span>`
    : "";
  return `<div style="position:absolute;left:0;top:0;transform:translate(-50%,calc(-100% - ${offset}px));display:grid;gap:4px;padding:8px 11px;border-radius:12px;background:#ffffff;box-shadow:0 10px 26px rgba(14,40,25,0.16);min-width:112px;max-width:200px;">
      <span style="font-size:12px;font-weight:650;color:${MAP_VISUAL_THEME.ink};">${escapeHtml(label)}</span>${pill}${sub}
    </div>`;
}

function createPointIcon(
  kind: DeliveryMapMarkerKind,
  label: string,
  subtitle: string | undefined,
  stepIndex: number | undefined,
  isSelected: boolean,
  muted = false,
  status?: DispatchMapStatusKey
) {
  const dotSize = isSelected ? 16 : 13;
  let html: string;

  if (kind === "destination") {
    const size = isSelected ? 32 : 26;
    const core = status ? getDispatchMapStatusMeta(status).dot : MAP_VISUAL_THEME.surface;
    html = `<div style="position:relative;width:0;height:0;overflow:visible;">
        <div style="position:absolute;left:0;top:0;transform:translate(-50%,-100%);">${pinSvg(size, core, muted)}</div>
        ${calloutHtml(label, subtitle, muted ? undefined : status, Math.round(size * 1.25) + 8)}
      </div>`;
  } else {
    // Collectes et étapes : pastilles encre ou blanches, numérotées pour les étapes.
    const stepTextColor = muted ? MAP_VISUAL_THEME.ink : MAP_VISUAL_THEME.surface;
    const background = kind === "pickup" ? MAP_VISUAL_THEME.surface : muted ? MAP_VISUAL_THEME.mutedLight : MAP_VISUAL_THEME.inkSoft;
    const border = kind === "pickup" ? MAP_VISUAL_THEME.ink : MAP_VISUAL_THEME.surface;
    const inner = kind === "step" && stepIndex != null
      ? `<span style="font-size:10px;font-weight:700;color:${stepTextColor};">${stepIndex}</span>`
      : "";
    const size = kind === "step" ? dotSize + 6 : dotSize;
    html = `<div style="position:relative;width:0;height:0;overflow:visible;">
        <div style="position:absolute;left:0;top:0;width:${size}px;height:${size}px;transform:translate(-50%,-50%);border-radius:50%;background:${background};border:3px solid ${border};box-shadow:0 2px 10px rgba(14,19,16,0.22);display:flex;align-items:center;justify-content:center;">${inner}</div>
        ${calloutHtml(label, subtitle, undefined, size / 2 + 10)}
      </div>`;
  }

  return L.divIcon({
    className: "delivery-point-marker",
    html,
    iconSize: [1, 1],
    iconAnchor: [0, 0],
  });
}

interface DeliveryPointMarkerProps {
  kind: DeliveryMapMarkerKind;
  latitude: number;
  longitude: number;
  label: string;
  subtitle?: string;
  stepIndex?: number;
  isSelected?: boolean;
  muted?: boolean;
  status?: DispatchMapStatusKey;
  /** Clic sur la destination sélectionnée : la désélectionner (deux clics rapprochés : le détail). */
  onClick?: () => void;
}

export function DeliveryPointMarker({
  kind,
  latitude,
  longitude,
  label,
  subtitle,
  stepIndex,
  isSelected = false,
  muted = false,
  status,
  onClick,
}: DeliveryPointMarkerProps) {
  const eventHandlers = useMarkerClicks(onClick);
  const icon = useMemo(
    () => createPointIcon(kind, label, subtitle, stepIndex, isSelected, muted, status),
    [kind, label, subtitle, stepIndex, isSelected, muted, status]
  );

  return (
    <Marker
      position={[latitude, longitude]}
      icon={icon}
      interactive={Boolean(onClick)}
      title={onClick ? "Clic : désélectionner · double-clic : voir le détail" : undefined}
      eventHandlers={eventHandlers}
      zIndexOffset={kind === "destination" ? 500 : kind === "pickup" ? 400 : 300}
    />
  );
}

/** Vue d'ensemble : une épingle par livraison, sans fiche, cliquable pour ouvrir la mission. */
export function DeliveryOverviewMarker({
  latitude,
  longitude,
  reference,
  title,
  status,
  subtitle,
  showCallout: calloutAllowed = true,
  onSelect,
}: {
  latitude: number;
  longitude: number;
  reference: string;
  /** Étiquette lisible (client ou adresse) ; la référence sert à défaut. */
  title?: string;
  status: DispatchMapStatusKey;
  subtitle?: string;
  /** Faux en vue éloignée : l'épingle seule, pour ne pas couvrir la carte de fiches. */
  showCallout?: boolean;
  onSelect: () => void;
}) {
  const eventHandlers = useMarkerClicks(onSelect);
  // Les missions qui demandent l'attention (retard) ou qui bougent (en route) portent leur fiche.
  const showCallout = calloutAllowed && (status === "late" || status === "route");
  const icon = useMemo(
    () =>
      L.divIcon({
        className: "delivery-point-marker",
        html: `<div style="position:relative;width:0;height:0;overflow:visible;cursor:pointer;">
            <div style="position:absolute;left:0;top:0;transform:translate(-50%,-100%);">${pinSvg(26, getDispatchMapStatusMeta(status).dot, false)}</div>
            ${showCallout ? calloutHtml(title || reference.replace(/^LIV-/, "#"), subtitle, status, 40) : ""}
          </div>`,
        iconSize: [1, 1],
        iconAnchor: [0, 0],
      }),
    [reference, showCallout, status, subtitle, title]
  );

  return (
    <Marker
      position={[latitude, longitude]}
      icon={icon}
      title={`${reference} · ${getDispatchMapStatusMeta(status).label} — clic : sélectionner · double-clic : voir le détail`}
      keyboard
      eventHandlers={eventHandlers}
      zIndexOffset={status === "late" ? 600 : 400}
    />
  );
}

/** Bulle de regroupement : nombre de livraisons, pastille rouge s'il y a un retard. */
export function DeliveryClusterMarker({
  latitude,
  longitude,
  count,
  hasLate,
  onSelect,
}: {
  latitude: number;
  longitude: number;
  count: number;
  hasLate: boolean;
  onSelect: () => void;
}) {
  const icon = useMemo(() => {
    const size = Math.min(56, 34 + count * 3);
    return L.divIcon({
      className: "delivery-point-marker",
      html: `<div style="position:relative;width:0;height:0;overflow:visible;cursor:pointer;">
          <div style="position:absolute;left:0;top:0;width:${size}px;height:${size}px;transform:translate(-50%,-50%);border-radius:50%;background:${MAP_VISUAL_THEME.ink};color:#ffffff;display:flex;align-items:center;justify-content:center;font:650 ${count > 9 ? 14 : 13}px/1 Inter,system-ui,sans-serif;box-shadow:0 0 0 5px rgba(255,255,255,0.85),0 8px 20px rgba(14,19,16,0.22);">${count}${
            hasLate
              ? `<span style="position:absolute;right:-1px;top:-1px;width:12px;height:12px;border-radius:50%;background:${MAP_VISUAL_THEME.danger};box-shadow:0 0 0 2px #ffffff;"></span>`
              : ""
          }</div>
        </div>`,
      iconSize: [1, 1],
      iconAnchor: [0, 0],
    });
  }, [count, hasLate]);

  return (
    <Marker
      position={[latitude, longitude]}
      icon={icon}
      title={`${count} livraisons${hasLate ? ", dont au moins une en retard" : ""} — zoomer sur la zone`}
      keyboard
      eventHandlers={{ click: onSelect, keypress: onSelect }}
      zIndexOffset={700}
    />
  );
}
