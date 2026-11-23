import { cn } from "@/lib/utils";

/**
 * Symbole Annona (DA-1, planche logo) : un soleil Aube qui se lève sur une ligne d'horizon.
 * Grille de 48 : soleil de rayon 14 posé 3 au-dessus de l'horizon ; horizon de 40 × 4, bouts arrondis.
 * Le soleil reste toujours Aube, sauf la version une couleur (`mono`, tampon et fax) ; l'horizon suit
 * la couleur du texte (`currentColor`) : encre sur clair, blanc sur encre. Taille mini : 16 px.
 */
export const BRAND_SUN_PATH = "M10 29a14 14 0 0 1 28 0z";

export function BrandMark({
  size = 24,
  mono = false,
  className,
  title,
}: {
  size?: number;
  mono?: boolean;
  className?: string;
  /** Nom accessible ; sans titre, le symbole est décoratif. */
  title?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      className={cn("shrink-0", className)}
      {...(title ? { role: "img", "aria-label": title } : { "aria-hidden": true })}
    >
      <path d={BRAND_SUN_PATH} fill={mono ? "currentColor" : "var(--color-aube, #ffd60a)"} />
      <rect x="4" y="32" width="40" height="4" rx="2" fill="currentColor" />
    </svg>
  );
}
