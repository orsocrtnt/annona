/**
 * Teintes d'état de la direction Menthe : un aplat très clair (Light) ou à peine teinté sur le graphite (Dark),
 * sans dégradé décoratif (décision du 28 octobre 2026). La bordure et l'icône portent l'urgence ;
 * le vert reste réservé à l'activité. `dot` : pastille de 8 px qui remplace le carré d'icône teinté
 * dans les vues sobres du dashboard (une seule touche de couleur par carte).
 */
export type Tone = "critical" | "warning" | "info" | "success" | "neutral";

export const TONE_CLASSES: Record<Tone, { surface: string; icon: string; value: string; dot: string }> = {
  critical: {
    surface: "border-[#f5dedb] bg-[#fef7f7] dark:border-[#5a3330] dark:bg-[#282120]",
    icon: "bg-[#fde3e0] text-[#c43b2f] dark:bg-[#4a2c2a] dark:text-error",
    value: "text-[#c43b2f] dark:text-error",
    dot: "bg-[#c43b2f] dark:bg-error",
  },
  warning: {
    surface: "border-[#f6e6d4] bg-[#fff9f4] dark:border-[#54432a] dark:bg-[#26231c]",
    icon: "bg-[#fde9d6] text-[#b45d0e] dark:bg-[#4a3a20] dark:text-warning",
    value: "text-foreground",
    dot: "bg-[#b45d0e] dark:bg-warning",
  },
  info: {
    surface: "border-[#dfe8f8] bg-[#f7f9fe] dark:border-[#2f4260] dark:bg-[#1d242c]",
    icon: "bg-[#e1ebfb] text-[#2f6fd1] dark:bg-[#26364f] dark:text-[#8fb5ee]",
    value: "text-foreground",
    dot: "bg-[#2f6fd1] dark:bg-[#8fb5ee]",
  },
  success: {
    surface: "border-[#ddf0e4] bg-[#f6fcf9] dark:border-[#2c4a3a] dark:bg-[#1c2722]",
    icon: "bg-[#dff5e8] text-brand dark:bg-[#24402f]",
    value: "text-foreground",
    dot: "bg-brand",
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
