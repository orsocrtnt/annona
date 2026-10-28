import type { CSSProperties } from "react";

/*
 * Verre des panneaux de carte. Chaque valeur lit une variable --map-glass-* dont le repli est la valeur
 * historique : hors portail (aucune variable définie) le rendu est inchangé ; le portail les redéfinit
 * en Dark et sous prefers-reduced-transparency (globals.css).
 */
export const mapGlassCardStyle: CSSProperties = {
  padding: "6px 12px",
  borderRadius: "12px",
  background: "var(--map-glass-bg, rgba(255, 255, 255, 0.97))",
  backdropFilter: "var(--map-glass-blur, blur(8px))",
  WebkitBackdropFilter: "var(--map-glass-blur, blur(8px))",
  border: "1px solid var(--map-glass-border, rgba(10, 10, 10, 0.10))",
  boxShadow: "var(--map-glass-shadow, 0 8px 28px rgba(0, 0, 0, 0.10))",
};

export const mapGlassButtonStyle: CSSProperties = {
  ...mapGlassCardStyle,
  width: 44,
  height: 44,
  padding: 0,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: 22,
  fontWeight: 600,
  lineHeight: 1,
  color: "var(--map-glass-button-fg, #111111)",
  background: "var(--map-glass-button-bg, #ffffff)",
  cursor: "pointer",
  flexShrink: 0,
};
