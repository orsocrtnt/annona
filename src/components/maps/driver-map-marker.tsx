"use client";

import { useMemo } from "react";
import L from "leaflet";
import { Marker } from "react-leaflet";
import { getDriverPresenceColor } from "@/lib/driver-presence";

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
  const dotColor = getDriverPresenceColor(isOnline, updatedAt);
  const cardOffset = dotSize / 2 + GAP;

  const nameBlock = lastName
    ? `<div style="font-size:${isSelected ? 12 : 11}px;font-weight:600;color:#0a0a0a;line-height:1.2;">${escapeHtml(firstName)}</div>
       <div style="font-size:${isSelected ? 11 : 10}px;font-weight:500;color:#52525b;line-height:1.2;margin-top:1px;">${escapeHtml(lastName)}</div>`
    : `<div style="font-size:${isSelected ? 12 : 11}px;font-weight:600;color:#0a0a0a;line-height:1.2;">${escapeHtml(firstName)}</div>`;

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
        background:${dotColor};
        border:3px solid #ffffff;
        box-shadow:0 2px 10px rgba(0,0,0,0.3),0 0 0 2px ${dotColor}40;
      "></div>
      <div style="
        position:absolute;
        left:0;
        top:0;
        transform:translate(-50%,calc(-100% - ${cardOffset}px));
        padding:${cardPadding};
        border-radius:${cardRadius};
        background:rgba(255,255,255,0.88);
        backdrop-filter:blur(12px);
        -webkit-backdrop-filter:blur(12px);
        border:1px solid rgba(255,255,255,0.95);
        box-shadow:0 4px 18px rgba(0,0,0,0.12),0 1px 4px rgba(0,0,0,0.06);
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
