/**
 * Teintes d'état de la direction Menthe : un léger dégradé depuis l'angle haut gauche,
 * qui s'efface vers le blanc. La couleur porte l'urgence ; le vert reste réservé à l'activité.
 */
export type Tone = "critical" | "warning" | "info" | "success" | "neutral";

export const TONE_CLASSES: Record<Tone, { surface: string; icon: string; value: string }> = {
  critical: {
    surface: "border-[#f5dedb] bg-[linear-gradient(160deg,#fdecea_0%,#ffffff_62%)] dark:border-[#5a3330] dark:bg-[linear-gradient(160deg,#3a2423_0%,var(--color-card)_62%)]",
    icon: "bg-[#fde3e0] text-[#c43b2f] dark:bg-[#4a2c2a] dark:text-error",
    value: "text-[#c43b2f] dark:text-error",
  },
  warning: {
    surface: "border-[#f6e6d4] bg-[linear-gradient(160deg,#fff1e3_0%,#ffffff_62%)] dark:border-[#54432a] dark:bg-[linear-gradient(160deg,#352a1a_0%,var(--color-card)_62%)]",
    icon: "bg-[#fde9d6] text-[#b45d0e] dark:bg-[#4a3a20] dark:text-warning",
    value: "text-foreground",
  },
  info: {
    surface: "border-[#dfe8f8] bg-[linear-gradient(160deg,#eaf1fd_0%,#ffffff_62%)] dark:border-[#2f4260] dark:bg-[linear-gradient(160deg,#1f2c40_0%,var(--color-card)_62%)]",
    icon: "bg-[#e1ebfb] text-[#2f6fd1] dark:bg-[#26364f] dark:text-[#8fb5ee]",
    value: "text-foreground",
  },
  success: {
    surface: "border-[#ddf0e4] bg-[linear-gradient(160deg,#e9f8ef_0%,#ffffff_62%)] dark:border-[#2c4a3a] dark:bg-[linear-gradient(160deg,#1b3328_0%,var(--color-card)_62%)]",
    icon: "bg-[#dff5e8] text-brand dark:bg-[#24402f]",
    value: "text-foreground",
  },
  neutral: {
    surface: "border-border bg-card",
    icon: "bg-muted text-foreground/70",
    value: "text-foreground",
  },
};

/** Une alerte critique à zéro ne doit pas inquiéter : elle reste neutre. */
export function resolveTone(tone: Tone | undefined, value: number): Tone {
  if (!tone) return "neutral";
  if (tone === "critical" && value <= 0) return "neutral";
  return tone;
}
