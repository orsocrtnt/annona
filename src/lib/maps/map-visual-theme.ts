/**
 * Direction « Suivi en direct » (planche A) : plan Menthe, repères encre, livreurs vert vif,
 * trajets verts. Le vert du trajet est un cran plus soutenu que celui de la charte pour garder
 * un contraste d'au moins 3:1 sur le plan comme sur son liseré blanc.
 */
export const MAP_VISUAL_THEME = {
  ink: "#0e1310",
  inkSoft: "#3f4842",
  muted: "#a1aaa4",
  mutedLight: "#d5dbd7",
  surface: "#ffffff",
  land: "#eef2ef",
  brand: "#00d46a",
  route: "#08a052",
  routeHalo: "#ffffff",
  danger: "#e5533f",
} as const;

export const MAP_ROUTE_STYLE = {
  halo: {
    color: MAP_VISUAL_THEME.routeHalo,
    weight: 11,
    opacity: 0.92,
    lineCap: "round" as const,
    lineJoin: "round" as const,
  },
  line: {
    color: MAP_VISUAL_THEME.route,
    weight: 6,
    opacity: 0.94,
    lineCap: "round" as const,
    lineJoin: "round" as const,
  },
} as const;

export type MapPaletteTheme = "light" | "dark";

/** Version sombre de la palette : encre et surface s'inversent, le trajet passe au vert pastel des jetons Dark. */
export const MAP_VISUAL_THEME_DARK = {
  ink: "#eef1ef",
  inkSoft: "#c3cbc6",
  muted: "#7f8983",
  mutedLight: "#3c4440",
  surface: "#1c1f1e",
  land: "#181c1a",
  brand: "#3dd68c",
  route: "#3dd68c",
  routeHalo: "#141716",
  danger: "#f08a82",
} as const;

export type MapPalette = { [K in keyof typeof MAP_VISUAL_THEME]: string };

export function mapPalette(theme: MapPaletteTheme): MapPalette {
  return theme === "dark" ? MAP_VISUAL_THEME_DARK : MAP_VISUAL_THEME;
}

/** Trajet halo + ligne pour le thème donné (le Clair reste `MAP_ROUTE_STYLE`). */
export function mapRouteStyle(theme: MapPaletteTheme) {
  if (theme === "light") return MAP_ROUTE_STYLE;
  return {
    halo: { ...MAP_ROUTE_STYLE.halo, color: MAP_VISUAL_THEME_DARK.routeHalo },
    line: { ...MAP_ROUTE_STYLE.line, color: MAP_VISUAL_THEME_DARK.route },
  } as const;
}
