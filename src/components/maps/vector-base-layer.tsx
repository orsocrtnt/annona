"use client";

import { useEffect, useState } from "react";
import { useMap } from "react-leaflet";
import { maplibreGL } from "@maplibre/maplibre-gl-leaflet";
import type { StyleSpecification } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { configureMaplibreWorker } from "@/lib/maps/maplibre-worker";
import { MAP_VECTOR, PROVIDER_TIMEOUT_MS } from "@/lib/maps/provider-config";
import { toMentheStyle } from "@/lib/maps/menthe-style";
import { ProviderTileLayer } from "@/components/maps/provider-tile-layer";

let cachedStyle: Promise<StyleSpecification> | null = null;

function loadMentheStyle(url: string): Promise<StyleSpecification> {
  cachedStyle ??= (async () => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), PROVIDER_TIMEOUT_MS);
    try {
      const response = await fetch(url, { signal: controller.signal });
      if (!response.ok) throw new Error(`style ${response.status}`);
      return toMentheStyle((await response.json()) as StyleSpecification);
    } finally {
      window.clearTimeout(timer);
    }
  })().catch((error) => {
    cachedStyle = null;
    throw error;
  });
  return cachedStyle;
}

/**
 * Fond vectoriel MapLibre posé dans la carte Leaflet : repères, trajets et cadrages
 * existants restent inchangés. En cas d'échec (réseau, style), retour au plan raster.
 */
export function BaseMapLayer({ onModeChange }: { onModeChange?: (mode: "vector" | "raster") => void }) {
  const map = useMap();
  const styleUrl = MAP_VECTOR.styleUrl;
  const [mode, setMode] = useState<"pending" | "vector" | "raster">(styleUrl ? "pending" : "raster");

  useEffect(() => {
    if (!styleUrl) return;
    let layer: ReturnType<typeof maplibreGL> | null = null;
    let cancelled = false;

    loadMentheStyle(styleUrl)
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
  }, [map, styleUrl]);

  useEffect(() => {
    if (mode !== "pending") onModeChange?.(mode);
  }, [mode, onModeChange]);

  return mode === "raster" ? <ProviderTileLayer /> : null;
}
