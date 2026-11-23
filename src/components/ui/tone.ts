/**
 * Teintes d'état de l'identité DA-1 : un aplat très clair (clair) ou à peine teinté sur l'encre (sombre),
 * sans dégradé décoratif. Une seule couleur d'alerte, le rouge Retard ; l'attention prend l'Aube foncée ;
 * le succès (« Livrée ») est une pastille Aube. La bordure et l'icône portent l'urgence. `dot` : pastille
 * de 8 px qui remplace le carré d'icône teinté dans les vues sobres du dashboard (une touche par carte).
 */
export type Tone = "critical" | "warning" | "info" | "success" | "neutral";

export const TONE_CLASSES: Record<Tone, { surface: string; icon: string; value: string; dot: string }> = {
  critical: {
    surface: "border-[#f6d3d1] bg-[#fdf4f4] dark:border-[#5a2a2d] dark:bg-[#2a1a1c]",
    icon: "bg-[#fdecec] text-[#b42318] dark:bg-[#45222a] dark:text-error",
    value: "text-[#b42318] dark:text-error",
    dot: "bg-retard dark:bg-error",
  },
  warning: {
    surface: "border-[#f1e2a6] bg-[#fffae6] dark:border-[#4d4418] dark:bg-[#24210f]",
    icon: "bg-[#fff1b8] text-[#7a5c00] dark:bg-[#3a3414] dark:text-warning",
    value: "text-foreground",
    dot: "bg-[#7a5c00] dark:bg-warning",
  },
  info: {
    surface: "border-border bg-[#f7f7f8] dark:border-[#33333d] dark:bg-[#1e1e27]",
    icon: "bg-muted text-foreground",
    value: "text-foreground",
    dot: "bg-foreground",
  },
  success: {
    surface: "border-[#ecebef] bg-[#fbfbfc] dark:border-[#3a3414] dark:bg-[#1f1e14]",
    icon: "bg-aube text-encre",
    value: "text-foreground",
    dot: "bg-aube",
  },
  neutral: {
    surface: "border-border bg-card",
    icon: "bg-muted text-foreground/70",
    value: "text-foreground",
    dot: "bg-muted-foreground/40",
  },
};

/** Une alerte critique à zéro ne doit pas inquiéter : elle reste neutre. */
export function resolveTone(tone: Tone | undefined, value: number): Tone {
  if (!tone) return "neutral";
  if (tone === "critical" && value <= 0) return "neutral";
  return tone;
}
