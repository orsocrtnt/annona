import type { CSSProperties } from "react";

export const mapGlassCardStyle: CSSProperties = {
  padding: "6px 12px",
  borderRadius: "12px",
  background: "rgba(255, 255, 255, 0.97)",
  backdropFilter: "blur(8px)",
  WebkitBackdropFilter: "blur(8px)",
  border: "1px solid rgba(10, 10, 10, 0.10)",
  boxShadow: "0 8px 28px rgba(0, 0, 0, 0.10)",
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
  color: "#111111",
  background: "#ffffff",
  cursor: "pointer",
  flexShrink: 0,
};
