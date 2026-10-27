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
