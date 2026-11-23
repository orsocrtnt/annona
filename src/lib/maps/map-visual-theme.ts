/**
 * DA-1 « En direct » : plan gris neutre, repères encre, livreur en Aube (le soleil qui pulse),
 * trajet encre en Clair et Aube en Sombre : au moins 3:1 sur le plan comme sur son liseré.
 */
export const MAP_VISUAL_THEME = {
  ink: "#0d0d12",
  inkSoft: "#3d3d46",
  muted: "#a1a1aa",
  mutedLight: "#d4d4da",
  surface: "#ffffff",
  land: "#f2f2f4",
  brand: "#ffd60a",
  route: "#0d0d12",
  routeHalo: "#ffffff",
  danger: "#e5484d",
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

/** Version sombre de la palette : encre et surface s'inversent, le trajet passe en Aube. */
export const MAP_VISUAL_THEME_DARK = {
  ink: "#ffffff",
  inkSoft: "#c8c8d0",
  muted: "#80808a",
  mutedLight: "#3a3a44",
  surface: "#1a1a22",
  land: "#14141a",
  brand: "#ffd60a",
  route: "#ffd60a",
  routeHalo: "#0d0d12",
  danger: "#ff8589",
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
