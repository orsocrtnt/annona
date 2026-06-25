import type { CSSProperties } from "react";

export const mapGlassCardStyle: CSSProperties = {
  padding: "6px 12px",
  borderRadius: "10px",
  background: "rgba(255, 255, 255, 0.88)",
  backdropFilter: "blur(12px)",
  WebkitBackdropFilter: "blur(12px)",
  border: "1px solid rgba(255, 255, 255, 0.95)",
  boxShadow: "0 4px 18px rgba(0, 0, 0, 0.12), 0 1px 4px rgba(0, 0, 0, 0.06)",
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
  fontWeight: 500,
  lineHeight: 1,
  color: "#0a0a0a",
  background: "#ffffff",
  cursor: "pointer",
  flexShrink: 0,
};
