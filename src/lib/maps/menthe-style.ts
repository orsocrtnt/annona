import type { StyleSpecification } from "maplibre-gl";

/**
 * Recolore le style vectoriel « Positron » (OpenFreeMap) aux teintes de DA-1 (nom de fichier historique) :
 * terre Brume, eau bleu-gris, parcs gris un cran plus soutenu, routes blanches, libellés en français.
 * Fonction pure : le style source est lu tel quel, une copie modifiée est renvoyée.
 */
export const MENTHE_MAP_PAINT: Record<string, Record<string, unknown>> = {
  background: { "background-color": "#f2f2f4" },
  park: { "fill-color": "#e6e6ea", "fill-opacity": 1 },
  water: { "fill-color": "#d3dce4" },
  waterway: { "line-color": "#d3dce4" },
  landuse_residential: { "fill-color": "#ededf0" },
  landcover_wood: { "fill-color": "#e6e6ea" },
  building: { "fill-color": "#e4e4e8" },
  highway_minor: { "line-color": "#ffffff" },
  highway_major_casing: { "line-color": "#dcdce2" },
  highway_major_inner: { "line-color": "#ffffff" },
  highway_major_subtle: { "line-color": "#ffffff" },
  highway_motorway_casing: { "line-color": "#d4d4da" },
  highway_motorway_inner: { "line-color": "#fbfbfc" },
  highway_motorway_subtle: { "line-color": "#fbfbfc" },
  railway_transit: { "line-color": "#e0e0e5" },
  railway: { "line-color": "#e0e0e5" },
};

/** Thème de la carte : suit le thème Clair / Sombre résolu de l'application. */
export type MapTheme = "light" | "dark";

/**
 * Variante sombre du même plan (encre + pastel) : mêmes couches, mêmes libellés, teintes alignées sur
 * les jetons Dark (`--color-background` #0d0d12). Routes plus claires que la terre pour rester lisibles.
 */
export const MENTHE_MAP_PAINT_DARK: Record<string, Record<string, unknown>> = {
  background: { "background-color": "#14141a" },
  park: { "fill-color": "#18181f", "fill-opacity": 1 },
  water: { "fill-color": "#141b24" },
  waterway: { "line-color": "#141b24" },
  landuse_residential: { "fill-color": "#17171d" },
  landcover_wood: { "fill-color": "#18181f" },
  // Bâtiments sans contour : de près, les traits clairs d'origine rendaient le plan chargé.
  building: { "fill-color": "#1c1c23", "fill-outline-color": "#1c1c23" },
  highway_minor: { "line-color": "#2c2c35" },
  highway_major_casing: { "line-color": "#0d0d12" },
  highway_major_inner: { "line-color": "#3a3a44" },
  highway_major_subtle: { "line-color": "#3a3a44" },
  highway_motorway_casing: { "line-color": "#0d0d12" },
  highway_motorway_inner: { "line-color": "#474752" },
  highway_motorway_subtle: { "line-color": "#474752" },
  railway_transit: { "line-color": "#24242c" },
  railway: { "line-color": "#24242c" },
  // Couches laissées aux teintes claires de Positron : ramenées dans l'encre pour ne plus briller.
  railway_dashline: { "line-color": "#1c1c22" },
  railway_transit_dashline: { "line-color": "#1c1c22" },
  tunnel_motorway_casing: { "line-color": "#0d0d12" },
  tunnel_motorway_inner: { "line-color": "#2a2a33" },
  road_area_pier: { "fill-color": "#17171d" },
  road_pier: { "line-color": "#17171d" },
  "aeroway-area": { "fill-color": "#17171d" },
  "aeroway-runway": { "line-color": "#2a2a33" },
  "aeroway-runway-casing": { "line-color": "#0d0d12" },
  "aeroway-taxiway": { "line-color": "#2a2a33" },
  landcover_ice_shelf: { "fill-color": "#17171d" },
  landcover_glacier: { "fill-color": "#17171d" },
  boundary_2: { "line-color": "#383842" },
  boundary_3: { "line-color": "#383842" },
  boundary_disputed: { "line-color": "#383842" },
};

/**
 * Détails masqués en Sombre seulement (retour du propriétaire, 29 octobre 2026 : « trop de détail » de
 * près) : trottoirs et chemins, voies de service ferroviaires et leurs noms. Le Clair reste complet.
 */
export const MENTHE_MAP_HIDDEN_DARK = new Set([
  "highway_path",
  "highway-name-path",
  "railway_service",
  "railway_service_dashline",
]);

/** Noms des petites rues, plus discrets en Sombre que ceux des grands axes. */
const DARK_MINOR_LABEL = "#80808a";

const SYMBOL_COLORS = {
  light: { city: "#3d3d46", other: "#a1a1aa", default: "#7a7a84", halo: "#f6f6f8" },
  dark: { city: "#d8d8de", other: "#80808a", default: "#a3a3ad", halo: "#0d0d12" },
} as const;

const FRENCH_NAME = ["coalesce", ["get", "name:fr"], ["get", "name"]];
const SHIELD_LAYERS = /^(highway-shield|road_shield)/;

export function toMentheStyle(source: StyleSpecification, theme: MapTheme = "light"): StyleSpecification {
  const style = structuredClone(source);
  const table = theme === "dark" ? MENTHE_MAP_PAINT_DARK : MENTHE_MAP_PAINT;
  const colors = SYMBOL_COLORS[theme];
  for (const layer of style.layers) {
    if (theme === "dark" && MENTHE_MAP_HIDDEN_DARK.has(layer.id)) {
      layer.layout = { ...(layer.layout ?? {}), visibility: "none" } as typeof layer.layout;
      continue;
    }
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
          : theme === "dark" && layer.id === "highway-name-minor"
            ? DARK_MINOR_LABEL
            : colors.default;
    }
    if ("text-halo-color" in symbolPaint) symbolPaint["text-halo-color"] = colors.halo;
    layer.paint = symbolPaint as typeof layer.paint;
  }
  return style;
}
