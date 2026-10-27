"use client";

import { useMemo } from "react";
import L from "leaflet";
import { Marker } from "react-leaflet";
import { motionPositionAt, type TrackingMotion } from "@/domains/tracking/tracking.policy";
import { useNow } from "@/hooks/use-now";
import { driverSignalLabel, getDriverPresenceStatus, TEAMS_PRESENCE } from "@/lib/driver-presence";
import { MAP_VISUAL_THEME } from "@/lib/maps/map-visual-theme";
import { withoutRolePrefix } from "@/lib/format/person-labels";

function escapeHtml(text: string) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function splitName(fullName: string) {
  // Le nom arrive parfois préfixé (« Livreur Jean Dupont ») : sans cela l'étiquette affichait « Livreur » / « Jean Dupont ».
  const trimmed = withoutRolePrefix(fullName);
  const space = trimmed.indexOf(" ");
  if (space === -1) return { firstName: trimmed, lastName: "" };
  return {
    firstName: trimmed.slice(0, space),
    lastName: trimmed.slice(space + 1),
  };
}

const DOT_SIZE = 32;
const DOT_SELECTED = 36;
const GAP = 12;
const TRUCK_ICON =
  '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 6h12v10H2zM14 10h4l3 3v3h-7z"/><circle cx="6" cy="18" r="2"/><circle cx="17" cy="18" r="2"/></svg>';

/** Le libellé du signal avance tout seul (« Il y a 3 min ») même quand les données ne changent pas. */
const SIGNAL_LABEL_TICK_MS = 30_000;
/** Livreur en route : il avance vers sa prochaine étape seconde après seconde, entre deux signaux. */
const MOTION_TICK_MS = 1_000;

function createDriverIcon(
  name: string,
  isSelected: boolean,
  presence: keyof typeof TEAMS_PRESENCE,
  signalLabel: string,
  showLabel = true
) {
  const { firstName, lastName } = splitName(name);
  const dotSize = isSelected ? DOT_SELECTED : DOT_SIZE;
  const presenceColor = TEAMS_PRESENCE[presence];
  const isOnline = presence === "online";
  const isLost = presence === "lost";
  const cardOffset = dotSize / 2 + GAP;
  const cardSurface = isSelected ? MAP_VISUAL_THEME.ink : MAP_VISUAL_THEME.surface;
  const primaryText = isSelected ? MAP_VISUAL_THEME.surface : MAP_VISUAL_THEME.ink;
  const secondaryText = isSelected ? "#d4d4d8" : "#52525b";

  const nameBlock = lastName
    ? `<div style="font-size:${isSelected ? 12 : 11}px;font-weight:650;color:${primaryText};line-height:1.2;">${escapeHtml(firstName)}</div>
       <div style="font-size:${isSelected ? 11 : 10}px;font-weight:500;color:${secondaryText};line-height:1.2;margin-top:1px;">${escapeHtml(lastName)}</div>`
    : `<div style="font-size:${isSelected ? 12 : 11}px;font-weight:650;color:${primaryText};line-height:1.2;">${escapeHtml(firstName)}</div>`;

  // Textes foncés sur la carte blanche (contraste AA), clairs sur la carte encre sélectionnée.
  const signalColor = isOnline
    ? isSelected ? MAP_VISUAL_THEME.brand : "#2f6f00"
    : isLost
      ? isSelected ? "#ff9aa8" : "#a4243b"
      : isSelected ? "#f5c75d" : "#7a5200";
  const signalBlock = `<div style="font-size:10px;font-weight:600;color:${signalColor};line-height:1.2;margin-top:3px;">${escapeHtml(signalLabel)}</div>`;
  // Camion vert tant que le livreur roule (en direct ou estimé) ; gris une fois le signal perdu.
  const dotSurface = `background:${isLost ? MAP_VISUAL_THEME.mutedLight : MAP_VISUAL_THEME.brand};`;
  const dotShadow = `0 0 0 4px #ffffff,0 8px 20px rgba(0,120,60,0.28)${isSelected ? `,0 0 0 6px ${MAP_VISUAL_THEME.ink}` : ""}`;

  const cardPadding = isSelected ? "7px 14px" : "6px 12px";
  const cardRadius = isSelected ? "12px" : "10px";

  // Ancre (0,0) = centre exact du point GPS — indépendant du zoom.
  // Planche A : pastille vert vif avec camion encre et halo pulsé tant que le livreur est en ligne.
  const html = `
    <div style="position:relative;width:0;height:0;overflow:visible;">
      ${isOnline ? `<span class="driver-map-pulse" style="position:absolute;left:0;top:0;width:${dotSize + 26}px;height:${dotSize + 26}px;"></span>` : ""}
      <div style="
        position:absolute;
        left:0;
        top:0;
        width:${dotSize}px;
        height:${dotSize}px;
        transform:translate(-50%,-50%);
        border-radius:50%;
        ${dotSurface}
        color:${MAP_VISUAL_THEME.ink};
        display:flex;align-items:center;justify-content:center;
        box-shadow:${dotShadow};
      ">${TRUCK_ICON}<span style="position:absolute;right:-3px;bottom:-3px;width:9px;height:9px;border-radius:50%;background:${presenceColor};border:2px solid #ffffff;"></span></div>
      <div style="
        position:absolute;
        left:0;
        top:0;
        transform:translate(-50%,calc(-100% - ${cardOffset}px));
        padding:${cardPadding};
        border-radius:${cardRadius};
        background:${cardSurface};
        backdrop-filter:blur(8px);
        -webkit-backdrop-filter:blur(8px);
        border:1px solid rgba(10,10,10,0.10);
        box-shadow:0 6px 20px rgba(0,0,0,0.10);
        text-align:center;
        white-space:nowrap;
        display:${showLabel ? "block" : "none"};
      ">${nameBlock}${signalBlock}</div>
    </div>
  `;

  return L.divIcon({
    className: "driver-map-pin-icon",
    html,
    iconSize: [1, 1],
    iconAnchor: [0, 0],
  });
}

interface DriverMapMarkerProps {
  name: string;
  latitude: number;
  longitude: number;
  isSelected?: boolean;
  isOnline?: boolean;
  /** Position estimée (signal périmé) plutôt que relevée. */
  estimated?: boolean;
  /** Trajet supposé : le marqueur avance vers la cible entre deux signaux, puis s'arrête signal perdu. */
  motion?: TrackingMotion | null;
  updatedAt?: string | null;
  onSelect?: () => void;
  /** Vue éloignée : la pastille seule, sans l'étiquette du nom. */
  showLabel?: boolean;
}

export function DriverMapMarker({
  name,
  latitude,
  longitude,
  isSelected = false,
  isOnline = false,
  estimated = false,
  motion = null,
  updatedAt = null,
  onSelect,
  showLabel = true,
}: DriverMapMarkerProps) {
  const now = useNow(motion ? MOTION_TICK_MS : SIGNAL_LABEL_TICK_MS);
  const signalLabel = driverSignalLabel({ isOnline, estimated, updatedAt }, now);
  const presence = getDriverPresenceStatus(isOnline, updatedAt, now);
  const position = motion ? motionPositionAt(motion, now) : { latitude, longitude };
  const icon = useMemo(
    () => createDriverIcon(name, isSelected, presence, signalLabel, showLabel),
    [name, isSelected, presence, signalLabel, showLabel]
  );

  return (
    <Marker
      position={[position.latitude, position.longitude]}
      icon={icon}
      title={`${withoutRolePrefix(name)} — ${signalLabel}`}
      eventHandlers={{ click: () => onSelect?.() }}
      // Au-dessus des épingles et de leurs fiches : le livreur reste toujours visible.
      zIndexOffset={isSelected ? 1100 : 900}
    />
  );
}
