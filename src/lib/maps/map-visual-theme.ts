/** Direction visuelle commune aux cartes TutelLiv : fond neutre, encre noire, surfaces blanches. */
export const MAP_VISUAL_THEME = {
  ink: "#111111",
  inkSoft: "#3f3f46",
  muted: "#a1a1aa",
  mutedLight: "#d4d4d8",
  surface: "#ffffff",
  route: "#111111",
  routeHalo: "#ffffff",
  danger: "#dc2626",
} as const;

export const MAP_ROUTE_STYLE = {
  halo: {
    color: MAP_VISUAL_THEME.routeHalo,
    weight: 10,
    opacity: 0.92,
    lineCap: "round" as const,
    lineJoin: "round" as const,
  },
  line: {
    color: MAP_VISUAL_THEME.route,
    weight: 5,
    opacity: 0.94,
    lineCap: "round" as const,
    lineJoin: "round" as const,
  },
} as const;
