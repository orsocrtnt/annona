import type { StyleSpecification } from "maplibre-gl";

/**
 * Recolore le style vectoriel « Positron » (OpenFreeMap) aux teintes de la direction Menthe :
 * terre vert très pâle, eau bleu-gris, parcs verts, routes blanches, libellés en français.
 * Fonction pure : le style source est lu tel quel, une copie modifiée est renvoyée.
 */
export const MENTHE_MAP_PAINT: Record<string, Record<string, unknown>> = {
  background: { "background-color": "#eef2ef" },
  park: { "fill-color": "#d9eadd", "fill-opacity": 1 },
  water: { "fill-color": "#c9dde6" },
  waterway: { "line-color": "#c9dde6" },
  landuse_residential: { "fill-color": "#e9eeea" },
  landcover_wood: { "fill-color": "#d9eadd" },
  building: { "fill-color": "#e2e8e3" },
  highway_minor: { "line-color": "#ffffff" },
  highway_major_casing: { "line-color": "#dde3de" },
  highway_major_inner: { "line-color": "#ffffff" },
  highway_major_subtle: { "line-color": "#ffffff" },
  highway_motorway_casing: { "line-color": "#d3dbd5" },
  highway_motorway_inner: { "line-color": "#fbfcfb" },
  highway_motorway_subtle: { "line-color": "#fbfcfb" },
  railway_transit: { "line-color": "#dfe4e0" },
  railway: { "line-color": "#dfe4e0" },
};

const FRENCH_NAME = ["coalesce", ["get", "name:fr"], ["get", "name"]];
const SHIELD_LAYERS = /^(highway-shield|road_shield)/;

export function toMentheStyle(source: StyleSpecification): StyleSpecification {
  const style = structuredClone(source);
  for (const layer of style.layers) {
    const paint = MENTHE_MAP_PAINT[layer.id];
    if (paint && "paint" in layer) {
      layer.paint = { ...(layer.paint ?? {}), ...paint } as typeof layer.paint;
    }
    if (layer.type !== "symbol") continue;
    if (layer.layout?.["text-field"] && !SHIELD_LAYERS.test(layer.id)) {
      layer.layout = { ...layer.layout, "text-field": FRENCH_NAME as never };
    }
    const symbolPaint = { ...(layer.paint ?? {}) } as Record<string, unknown>;
    if ("text-color" in symbolPaint) {
      symbolPaint["text-color"] = layer.id.startsWith("label_city")
        ? "#3c4640"
        : layer.id === "label_other"
          ? "#a3ada6"
          : "#7a857e";
    }
    if ("text-halo-color" in symbolPaint) symbolPaint["text-halo-color"] = "#f4f7f5";
    layer.paint = symbolPaint as typeof layer.paint;
  }
  return style;
}
