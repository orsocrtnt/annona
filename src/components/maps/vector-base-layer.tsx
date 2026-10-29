"use client";

import { useEffect, useState } from "react";
import { useMap } from "react-leaflet";
import { maplibreGL } from "@maplibre/maplibre-gl-leaflet";
import type { StyleSpecification } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { configureMaplibreWorker } from "@/lib/maps/maplibre-worker";
import { MAP_VECTOR, PROVIDER_TIMEOUT_MS } from "@/lib/maps/provider-config";
import { toMentheStyle, type MapTheme } from "@/lib/maps/menthe-style";
import { ProviderTileLayer } from "@/components/maps/provider-tile-layer";

import { useMapTheme } from "@/hooks/use-map-theme";

const cachedStyles: Partial<Record<MapTheme, Promise<StyleSpecification>>> = {};

function loadMentheStyle(url: string, theme: MapTheme): Promise<StyleSpecification> {
  cachedStyles[theme] ??= (async () => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), PROVIDER_TIMEOUT_MS);
    try {
      const response = await fetch(url, { signal: controller.signal });
      if (!response.ok) throw new Error(`style ${response.status}`);
      return toMentheStyle((await response.json()) as StyleSpecification, theme);
    } finally {
      window.clearTimeout(timer);
    }
  })().catch((error) => {
    delete cachedStyles[theme];
    throw error;
  });
  return cachedStyles[theme]!;
}

/**
 * Fond vectoriel MapLibre posé dans la carte Leaflet : repères, trajets et cadrages
 * existants restent inchangés. En cas d'échec (réseau, style), retour au plan raster.
 */
export function BaseMapLayer({ onModeChange }: { onModeChange?: (mode: "vector" | "raster") => void }) {
  const map = useMap();
  const styleUrl = MAP_VECTOR.styleUrl;
  const theme = useMapTheme();
  const [mode, setMode] = useState<"pending" | "vector" | "raster">(styleUrl ? "pending" : "raster");

  useEffect(() => {
    if (!styleUrl) return;
    let layer: ReturnType<typeof maplibreGL> | null = null;
    let cancelled = false;

    loadMentheStyle(styleUrl, theme)
      .then((style) => {
        if (cancelled) return;
        configureMaplibreWorker();
        layer = maplibreGL({ style, attributionControl: false });
        layer.addTo(map);
        setMode("vector");
      })
      .catch(() => {
        if (!cancelled) setMode("raster");
      });

    return () => {
      cancelled = true;
      if (layer) map.removeLayer(layer);
    };
  }, [map, styleUrl, theme]);

  useEffect(() => {
    if (mode !== "pending") onModeChange?.(mode);
  }, [mode, onModeChange]);

  return mode === "raster" ? <ProviderTileLayer /> : null;
}
