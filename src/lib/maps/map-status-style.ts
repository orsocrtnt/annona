import type { DispatchMapStatusKey } from "@/features/back-office/dispatch-map-status";
import type { MapPaletteTheme } from "@/lib/maps/map-visual-theme";

/**
 * Statut d'une livraison sur la carte : couleur du cœur de l'épingle + forme + libellé.
 * La forme et le libellé portent le sens ; la couleur le renforce (jamais seule).
 * Les couleurs sont choisies pour garder au moins 3:1 sur le corps de l'épingle de leur thème.
 */
export type MapStatusShape = "triangle" | "ring" | "square" | "circle";

export const MAP_PIN_BODY: Record<MapPaletteTheme, string> = { light: "#0e1310", dark: "#eef1ef" };
export const MAP_PIN_OUTLINE: Record<MapPaletteTheme, string> = { light: "#ffffff", dark: "#141716" };

export const MAP_STATUS_STYLE: Record<
  MapPaletteTheme,
  Record<DispatchMapStatusKey, { core: string; shape: MapStatusShape; text: string; surface: string }>
> = {
  light: {
    late: { core: "#ff7a6b", shape: "triangle", text: "#b8352b", surface: "#fde3e0" },
    unassigned: { core: "#ffb15c", shape: "ring", text: "#a8560d", surface: "#fde9d6" },
    pending: { core: "#7fb0ff", shape: "square", text: "#2a62bd", surface: "#e1ebfb" },
    route: { core: "#00d46a", shape: "circle", text: "#08783f", surface: "#dff5e8" },
  },
  dark: {
    late: { core: "#c4311f", shape: "triangle", text: "#f08a82", surface: "#3d2523" },
    unassigned: { core: "#b35a00", shape: "ring", text: "#f0b45c", surface: "#3a2f1c" },
    pending: { core: "#2a62bd", shape: "square", text: "#8fb4f0", surface: "#1f2c44" },
    route: { core: "#08783f", shape: "circle", text: "#5bd99a", surface: "#1b3328" },
  },
};

/** Forme SVG (centrée en 13,13) du cœur d'une épingle de 26 × 32. */
export function statusCoreSvg(shape: MapStatusShape, color: string): string {
  switch (shape) {
    case "triangle":
      return `<path d="M13 8.2 18 17H8z" fill="${color}" stroke="${color}" stroke-width="1.2" stroke-linejoin="round"/>`;
    case "ring":
      return `<circle cx="13" cy="13" r="4" fill="none" stroke="${color}" stroke-width="2.4"/>`;
    case "square":
      return `<rect x="9" y="9" width="8" height="8" rx="1.5" fill="${color}"/>`;
    default:
      return `<circle cx="13" cy="13" r="4.6" fill="${color}"/>`;
  }
}

export const MAP_SHAPE_LABEL: Record<MapStatusShape, string> = {
  triangle: "triangle",
  ring: "anneau",
  square: "carré",
  circle: "disque",
};
