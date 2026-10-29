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

/** Thème de la carte : suit le thème Clair / Sombre résolu de l'application. */
export type MapTheme = "light" | "dark";

/**
 * Variante sombre du même plan (encre + pastel) : mêmes couches, mêmes libellés, teintes alignées sur
 * les jetons Dark (`--color-background` #141716). Routes plus claires que la terre pour rester lisibles.
 */
export const MENTHE_MAP_PAINT_DARK: Record<string, Record<string, unknown>> = {
  background: { "background-color": "#181c1a" },
  park: { "fill-color": "#1c2a22", "fill-opacity": 1 },
  water: { "fill-color": "#16252d" },
  waterway: { "line-color": "#16252d" },
  landuse_residential: { "fill-color": "#1b1f1d" },
  landcover_wood: { "fill-color": "#1c2a22" },
  building: { "fill-color": "#212624" },
  highway_minor: { "line-color": "#323936" },
  highway_major_casing: { "line-color": "#141716" },
  highway_major_inner: { "line-color": "#3c4440" },
  highway_major_subtle: { "line-color": "#3c4440" },
  highway_motorway_casing: { "line-color": "#141716" },
  highway_motorway_inner: { "line-color": "#48524d" },
  highway_motorway_subtle: { "line-color": "#48524d" },
  railway_transit: { "line-color": "#2a302d" },
  railway: { "line-color": "#2a302d" },
};

const SYMBOL_COLORS = {
  light: { city: "#3c4640", other: "#a3ada6", default: "#7a857e", halo: "#f4f7f5" },
  dark: { city: "#d7ded9", other: "#7f8983", default: "#a3aca6", halo: "#141716" },
} as const;

const FRENCH_NAME = ["coalesce", ["get", "name:fr"], ["get", "name"]];
const SHIELD_LAYERS = /^(highway-shield|road_shield)/;

export function toMentheStyle(source: StyleSpecification, theme: MapTheme = "light"): StyleSpecification {
  const style = structuredClone(source);
  const table = theme === "dark" ? MENTHE_MAP_PAINT_DARK : MENTHE_MAP_PAINT;
  const colors = SYMBOL_COLORS[theme];
  for (const layer of style.layers) {
    const paint = table[layer.id];
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
        ? colors.city
        : layer.id === "label_other"
          ? colors.other
          : colors.default;
    }
    if ("text-halo-color" in symbolPaint) symbolPaint["text-halo-color"] = colors.halo;
    layer.paint = symbolPaint as typeof layer.paint;
  }
  return style;
}
