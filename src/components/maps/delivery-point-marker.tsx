"use client";

import { useMemo } from "react";
import L from "leaflet";
import { Marker } from "react-leaflet";
import type { DeliveryMapMarkerKind } from "@/features/back-office/dispatch-delivery-map-state";
import { MAP_VISUAL_THEME } from "@/lib/maps/map-visual-theme";

function escapeHtml(text: string) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const MARKER_COLORS: Record<DeliveryMapMarkerKind, string> = {
  destination: MAP_VISUAL_THEME.ink,
  pickup: MAP_VISUAL_THEME.surface,
  step: MAP_VISUAL_THEME.inkSoft,
};

const MUTED_MARKER_COLORS: Record<DeliveryMapMarkerKind, string> = {
  destination: MAP_VISUAL_THEME.muted,
  pickup: MAP_VISUAL_THEME.surface,
  step: MAP_VISUAL_THEME.mutedLight,
};

function createPointIcon(
  kind: DeliveryMapMarkerKind,
  label: string,
  subtitle: string | undefined,
  stepIndex: number | undefined,
  isSelected: boolean,
  muted = false
) {
  const color = (muted ? MUTED_MARKER_COLORS : MARKER_COLORS)[kind];
  const dotSize = isSelected ? 16 : 13;
  const cardOffset = dotSize / 2 + 10;
  const stepTextColor = muted ? MAP_VISUAL_THEME.ink : MAP_VISUAL_THEME.surface;
  const innerLabel =
    kind === "step" && stepIndex != null
      ? `<span style="font-size:10px;font-weight:700;color:${stepTextColor};">${stepIndex}</span>`
      : "";
  const selectedSurface = isSelected ? MAP_VISUAL_THEME.ink : MAP_VISUAL_THEME.surface;
  const selectedText = isSelected ? MAP_VISUAL_THEME.surface : MAP_VISUAL_THEME.ink;
  const selectedMutedText = isSelected ? "#d4d4d8" : "#71717a";
  const dotBorder = kind === "pickup" ? MAP_VISUAL_THEME.ink : MAP_VISUAL_THEME.surface;

  const subtitleBlock = subtitle
    ? `<div style="font-size:10px;color:${selectedMutedText};margin-top:2px;max-width:160px;white-space:normal;line-height:1.25;">${escapeHtml(subtitle)}</div>`
    : "";

  const html = `
    <div style="position:relative;width:0;height:0;overflow:visible;">
      <div style="
        position:absolute;left:0;top:0;
        width:${dotSize}px;height:${dotSize}px;
        transform:translate(-50%,-50%);
        border-radius:50%;
        background:${color};
        border:3px solid ${dotBorder};
        box-shadow:0 2px 10px rgba(0,0,0,0.22)${isSelected ? ",0 0 0 2px #111111" : ""};
        display:flex;align-items:center;justify-content:center;
      ">${innerLabel}</div>
      <div style="
        position:absolute;left:0;top:0;
        transform:translate(-50%,calc(-100% - ${cardOffset}px));
        padding:6px 11px;border-radius:10px;
        background:${selectedSurface};
        backdrop-filter:blur(8px);
        border:1px solid rgba(10,10,10,0.10);
        box-shadow:0 6px 20px rgba(0,0,0,0.10);
        text-align:center;max-width:180px;
      ">
        <div style="font-size:11px;font-weight:650;color:${selectedText};">${escapeHtml(label)}</div>
        ${subtitleBlock}
      </div>
    </div>
  `;

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
}: DeliveryPointMarkerProps) {
  const icon = useMemo(
    () => createPointIcon(kind, label, subtitle, stepIndex, isSelected, muted),
    [kind, label, subtitle, stepIndex, isSelected, muted]
  );

  return (
    <Marker
      position={[latitude, longitude]}
      icon={icon}
      zIndexOffset={kind === "destination" ? 500 : kind === "pickup" ? 400 : 300}
    />
  );
}
