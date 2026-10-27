import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import type { StyleSpecification } from "maplibre-gl";
import { toMentheStyle } from "../src/lib/maps/menthe-style";
import { vectorStyleConfig } from "../src/lib/maps/provider-config";

const source = {
  version: 8,
  sources: {},
  layers: [
    { id: "background", type: "background", paint: { "background-color": "#fff" } },
    { id: "water", type: "fill", source: "x", "source-layer": "water", paint: { "fill-color": "#000" } },
    { id: "label_city", type: "symbol", source: "x", "source-layer": "place", layout: { "text-field": ["get", "name_en"] }, paint: { "text-color": "#000", "text-halo-color": "#fff" } },
    { id: "highway-shield-non-us", type: "symbol", source: "x", "source-layer": "transportation_name", layout: { "text-field": "{ref}" }, paint: {} },
  ],
} as unknown as StyleSpecification;

test("MAP-4 : le style vectoriel est recoloré Menthe et nommé en français, sans toucher la source", () => {
  const style = toMentheStyle(source);
  const byId = Object.fromEntries(style.layers.map((layer) => [layer.id, layer])) as Record<string, { paint?: Record<string, unknown>; layout?: Record<string, unknown> }>;
  assert.equal(byId.background!.paint!["background-color"], "#eef2ef");
  assert.equal(byId.water!.paint!["fill-color"], "#c9dde6");
  assert.deepEqual(byId.label_city!.layout!["text-field"], ["coalesce", ["get", "name:fr"], ["get", "name"]]);
  assert.equal(byId.label_city!.paint!["text-color"], "#3c4640");
  assert.equal(byId["highway-shield-non-us"]!.layout!["text-field"], "{ref}", "les numéros de route restent intacts");
  assert.equal((source.layers[0] as unknown as { paint: Record<string, string> }).paint["background-color"], "#fff");
});

test("MAP-4 : le plan vectoriel est OpenFreeMap par défaut et se désactive avec une valeur vide", () => {
  assert.equal(vectorStyleConfig(undefined).styleUrl, "https://tiles.openfreemap.org/styles/positron");
  assert.equal(vectorStyleConfig("").styleUrl, null);
  assert.equal(vectorStyleConfig(" https://tiles.example/style.json ").styleUrl, "https://tiles.example/style.json");
});

test("MAP-4 : en cas d'échec du plan vectoriel, la carte revient au plan raster", () => {
  const layer = readFileSync("src/components/maps/vector-base-layer.tsx", "utf8");
  assert.match(layer, /setMode\("raster"\)/);
  assert.match(layer, /mode === "raster" \? <ProviderTileLayer \/>/);
});
