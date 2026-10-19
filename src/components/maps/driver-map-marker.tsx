"use client";

import { useMemo } from "react";
import L from "leaflet";
import { Marker } from "react-leaflet";
import { getDriverPresenceColor } from "@/lib/driver-presence";
import { MAP_VISUAL_THEME } from "@/lib/maps/map-visual-theme";

function escapeHtml(text: string) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function splitName(fullName: string) {
  const trimmed = fullName.trim();
  const space = trimmed.indexOf(" ");
  if (space === -1) return { firstName: trimmed, lastName: "" };
  return {
    firstName: trimmed.slice(0, space),
    lastName: trimmed.slice(space + 1),
  };
}

const DOT_SIZE = 14;
const DOT_SELECTED = 18;
const GAP = 10;

function createDriverIcon(
  name: string,
  isSelected: boolean,
  isOnline: boolean,
  updatedAt: string | null
) {
  const { firstName, lastName } = splitName(name);
  const dotSize = isSelected ? DOT_SELECTED : DOT_SIZE;
  const presenceColor = getDriverPresenceColor(isOnline, updatedAt);
  const cardOffset = dotSize / 2 + GAP;
  const cardSurface = isSelected ? MAP_VISUAL_THEME.ink : MAP_VISUAL_THEME.surface;
  const primaryText = isSelected ? MAP_VISUAL_THEME.surface : MAP_VISUAL_THEME.ink;
  const secondaryText = isSelected ? "#d4d4d8" : "#52525b";

  const nameBlock = lastName
    ? `<div style="font-size:${isSelected ? 12 : 11}px;font-weight:650;color:${primaryText};line-height:1.2;">${escapeHtml(firstName)}</div>
       <div style="font-size:${isSelected ? 11 : 10}px;font-weight:500;color:${secondaryText};line-height:1.2;margin-top:1px;">${escapeHtml(lastName)}</div>`
    : `<div style="font-size:${isSelected ? 12 : 11}px;font-weight:650;color:${primaryText};line-height:1.2;">${escapeHtml(firstName)}</div>`;

  const cardPadding = isSelected ? "7px 14px" : "6px 12px";
  const cardRadius = isSelected ? "12px" : "10px";

  // Ancre (0,0) = centre exact du point GPS — indépendant du zoom
  const html = `
    <div style="position:relative;width:0;height:0;overflow:visible;">
      <div style="
        position:absolute;
        left:0;
        top:0;
        width:${dotSize}px;
        height:${dotSize}px;
        transform:translate(-50%,-50%);
        border-radius:50%;
        background:${MAP_VISUAL_THEME.ink};
        border:3px solid #ffffff;
        box-shadow:0 2px 10px rgba(0,0,0,0.26)${isSelected ? ",0 0 0 2px #111111" : ""};
      "><span style="position:absolute;right:-2px;bottom:-2px;width:7px;height:7px;border-radius:50%;background:${presenceColor};border:1.5px solid #ffffff;"></span></div>
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
      ">${nameBlock}</div>
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
  updatedAt?: string | null;
  onSelect?: () => void;
}

export function DriverMapMarker({
  name,
  latitude,
  longitude,
  isSelected = false,
  isOnline = false,
  updatedAt = null,
  onSelect,
}: DriverMapMarkerProps) {
  const icon = useMemo(
    () => createDriverIcon(name, isSelected, isOnline, updatedAt),
    [name, isSelected, isOnline, updatedAt]
  );

  return (
    <Marker
      position={[latitude, longitude]}
      icon={icon}
      eventHandlers={{ click: () => onSelect?.() }}
      zIndexOffset={isSelected ? 1000 : 0}
    />
  );
}
