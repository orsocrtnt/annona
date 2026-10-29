"use client";

import { useMemo } from "react";
import L from "leaflet";
import { Marker } from "react-leaflet";
import type { DeliveryMapMarkerKind } from "@/features/back-office/dispatch-delivery-map-state";
import {
  getDispatchMapStatusMeta,
  type DispatchMapStatusKey,
} from "@/features/back-office/dispatch-map-status";
import { useMapTheme } from "@/hooks/use-map-theme";
import { mapPalette, type MapPaletteTheme } from "@/lib/maps/map-visual-theme";
import { MAP_SHAPE_LABEL, MAP_PIN_BODY, MAP_PIN_OUTLINE, MAP_STATUS_STYLE, statusCoreSvg } from "@/lib/maps/map-status-style";

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
        if (event.originalEvent.key === "Enter" || event.originalEvent.key === " ") onClick?.();
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

/**
 * Épingle de la planche A : corps encre en Clair, clair en Sombre. Le cœur porte le statut par sa forme
 * (triangle en retard, anneau sans livreur, carré à démarrer, disque en route) et sa couleur mesurée.
 */
function pinSvg(size: number, status: DispatchMapStatusKey | undefined, muted: boolean, theme: MapPaletteTheme, selected = false) {
  const palette = mapPalette(theme);
  const fill = muted ? palette.muted : MAP_PIN_BODY[theme];
  const outline = MAP_PIN_OUTLINE[theme];
  const style = status ? MAP_STATUS_STYLE[theme][status] : null;
  const core = style ? statusCoreSvg(style.shape, style.core) : `<circle cx="13" cy="13" r="4.6" fill="${palette.surface}"/>`;
  const ring = selected ? `<path d="M13 31s11-10.5 11-18A11 11 0 0 0 2 13c0 7.5 11 18 11 18z" fill="none" stroke="${palette.brand}" stroke-width="4.5"/>` : "";
  return `<svg width="${size}" height="${Math.round(size * 1.25)}" viewBox="0 0 26 32" aria-hidden="true" style="display:block;overflow:visible;filter:drop-shadow(0 4px 8px rgba(14,19,16,0.25))">${ring}<path d="M13 31s11-10.5 11-18A11 11 0 0 0 2 13c0 7.5 11 18 11 18z" fill="${fill}" stroke="${outline}" stroke-width="1.5"/>${core}</svg>`;
}

function calloutHtml(label: string, subtitle: string | undefined, status: DispatchMapStatusKey | undefined, offset: number, theme: MapPaletteTheme) {
  const palette = mapPalette(theme);
  const pill = status
    ? `<span style="justify-self:start;font-size:10.5px;font-weight:600;padding:2px 8px;border-radius:999px;background:${MAP_STATUS_STYLE[theme][status].surface};color:${MAP_STATUS_STYLE[theme][status].text};">${getDispatchMapStatusMeta(status).label}</span>`
    : "";
  const sub = subtitle
    ? `<span style="font-size:10.5px;color:${theme === "dark" ? "#a3aca6" : "#68726b"};max-width:170px;white-space:normal;line-height:1.3;">${escapeHtml(subtitle)}</span>`
    : "";
  const shadow = theme === "dark" ? "0 10px 26px rgba(0,0,0,0.5)" : "0 10px 26px rgba(14,40,25,0.16)";
  return `<div style="position:absolute;left:0;top:0;transform:translate(-50%,calc(-100% - ${offset}px));display:grid;gap:4px;padding:8px 11px;border-radius:12px;background:${palette.surface};box-shadow:${shadow};min-width:112px;max-width:200px;">
      <span style="font-size:12px;font-weight:650;color:${palette.ink};">${escapeHtml(label)}</span>${pill}${sub}
    </div>`;
}

function createPointIcon(
  kind: DeliveryMapMarkerKind,
  label: string,
  subtitle: string | undefined,
  stepIndex: number | undefined,
  isSelected: boolean,
  muted = false,
  status?: DispatchMapStatusKey,
  theme: MapPaletteTheme = "light"
) {
  const palette = mapPalette(theme);
  const dotSize = isSelected ? 16 : 13;
  let html: string;

  if (kind === "destination") {
    const size = isSelected ? 32 : 26;
        html = `<div style="position:relative;width:0;height:0;overflow:visible;">
        <div style="position:absolute;left:0;top:0;transform:translate(-50%,-100%);">${pinSvg(size, status, muted, theme, isSelected)}</div>
        ${calloutHtml(label, subtitle, muted ? undefined : status, Math.round(size * 1.25) + 8, theme)}
      </div>`;
  } else {
    // Collectes et étapes : pastilles encre ou blanches, numérotées pour les étapes.
    const stepTextColor = muted ? palette.ink : palette.surface;
    const background = kind === "pickup" ? palette.surface : muted ? palette.mutedLight : palette.inkSoft;
    const border = kind === "pickup" ? palette.ink : palette.surface;
    const inner = kind === "step" && stepIndex != null
      ? `<span style="font-size:10px;font-weight:700;color:${stepTextColor};">${stepIndex}</span>`
      : "";
    const size = kind === "step" ? dotSize + 6 : dotSize;
    html = `<div style="position:relative;width:0;height:0;overflow:visible;">
        <div style="position:absolute;left:0;top:0;width:${size}px;height:${size}px;transform:translate(-50%,-50%);border-radius:50%;background:${background};border:3px solid ${border};box-shadow:0 2px 10px rgba(14,19,16,0.22);display:flex;align-items:center;justify-content:center;">${inner}</div>
        ${calloutHtml(label, subtitle, undefined, size / 2 + 10, theme)}
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
  const theme = useMapTheme();
  const icon = useMemo(
    () => createPointIcon(kind, label, subtitle, stepIndex, isSelected, muted, status, theme),
    [kind, label, subtitle, stepIndex, isSelected, muted, status, theme]
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
  isSelected = false,
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
  /** Épingle sélectionnée : plus grande, cerclée de la couleur de marque, fiche toujours affichée. */
  isSelected?: boolean;
  onSelect: () => void;
}) {
  const eventHandlers = useMarkerClicks(onSelect);
  const theme = useMapTheme();
  // Les missions qui demandent l'attention (retard) ou qui bougent (en route) portent leur fiche.
  const showCallout = isSelected || (calloutAllowed && (status === "late" || status === "route"));
  const icon = useMemo(
    () =>
      L.divIcon({
        className: "delivery-point-marker",
        html: `<div style="position:relative;width:0;height:0;overflow:visible;cursor:pointer;">
            <div style="position:absolute;left:0;top:0;transform:translate(-50%,-100%);">${pinSvg(isSelected ? 32 : 26, status, false, theme, isSelected)}</div>
            ${showCallout ? calloutHtml(title || reference.replace(/^LIV-/, "#"), subtitle, status, isSelected ? 48 : 40, theme) : ""}
          </div>`,
        iconSize: [1, 1],
        iconAnchor: [0, 0],
      }),
    [isSelected, reference, showCallout, status, subtitle, theme, title]
  );

  return (
    <Marker
      position={[latitude, longitude]}
      icon={icon}
      title={`${reference} · ${getDispatchMapStatusMeta(status).label} (${MAP_SHAPE_LABEL[MAP_STATUS_STYLE[theme][status].shape]}) — clic ou Entrée : sélectionner`}
      keyboard
      eventHandlers={eventHandlers}
      zIndexOffset={isSelected ? 1000 : status === "late" ? 600 : 400}
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
  const theme = useMapTheme();
  const icon = useMemo(() => {
    const palette = mapPalette(theme);
    const size = Math.min(56, 34 + count * 3);
    return L.divIcon({
      className: "delivery-point-marker",
      html: `<div style="position:relative;width:0;height:0;overflow:visible;cursor:pointer;">
          <div style="position:absolute;left:0;top:0;width:${size}px;height:${size}px;transform:translate(-50%,-50%);border-radius:50%;background:${palette.ink};color:${palette.surface};display:flex;align-items:center;justify-content:center;font:650 ${count > 9 ? 14 : 13}px/1 Inter,system-ui,sans-serif;box-shadow:0 0 0 5px ${theme === "dark" ? "rgba(20,23,22,0.85)" : "rgba(255,255,255,0.85)"},0 8px 20px rgba(14,19,16,0.22);">${count}${
            hasLate
              ? `<span style="position:absolute;right:-1px;top:-1px;width:12px;height:12px;border-radius:50%;background:${palette.danger};box-shadow:0 0 0 2px ${palette.surface};"></span>`
              : ""
          }</div>
        </div>`,
      iconSize: [1, 1],
      iconAnchor: [0, 0],
    });
  }, [count, hasLate, theme]);

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
