import { BrandMark } from "@/components/brand/brand-mark";
import { APP_NAME } from "@/lib/constants";
import { cn } from "@/lib/utils";

const SIZES = {
  sm: { mark: 26, text: "text-[22px]", gap: "gap-1" },
  md: { mark: 32, text: "text-[27px]", gap: "gap-1.5" },
} as const;

/**
 * Logo Annona (DA-1) : le soleil sur l'horizon, puis le mot en minuscules, Geist 700, serré (−6 %).
 * Le nom est porté par un texte masqué (lecteurs d'écran, liens nommés « Annona ») ; le dessin est décoratif.
 * La couleur suit le texte : encre sur clair, blanc en thème sombre ou avec `onDark`.
 */
export function BrandLogo({
  onDark = false,
  size = "sm",
  className,
}: {
  onDark?: boolean;
  size?: keyof typeof SIZES;
  className?: string;
  /** Conservé pour compatibilité : le logo est en SVG et texte, rien à précharger. */
  priority?: boolean;
}) {
  const s = SIZES[size];
  return (
    <span
      className={cn(
        "inline-flex items-center leading-none",
        s.gap,
        onDark ? "text-white" : "text-foreground",
        className,
      )}
    >
      <BrandMark size={s.mark} />
      <span aria-hidden className={cn("font-sans font-bold tracking-[-0.06em]", s.text)}>
        annona
      </span>
      <span className="sr-only">{APP_NAME}</span>
    </span>
  );
}
