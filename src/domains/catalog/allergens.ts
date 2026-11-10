/**
 * Lot 1, demande 3 — les 14 allergènes réglementaires (règlement (UE) n° 1169/2011, annexe II), dans
 * l'ordre de la demande. Seuls les allergènes sont demandés : ni ingrédients, ni poids, ni description.
 * Module pur, utilisable côté navigateur.
 */
export const ALLERGENS = [
  { code: "GLUTEN", label: "Céréales contenant du gluten" },
  { code: "CRUSTACEANS", label: "Crustacés" },
  { code: "EGGS", label: "Œufs" },
  { code: "FISH", label: "Poissons" },
  { code: "PEANUTS", label: "Arachides" },
  { code: "SOY", label: "Soja" },
  { code: "MILK", label: "Lait" },
  { code: "NUTS", label: "Fruits à coque" },
  { code: "CELERY", label: "Céleri" },
  { code: "MUSTARD", label: "Moutarde" },
  { code: "SESAME", label: "Graines de sésame" },
  { code: "SULPHITES", label: "Anhydride sulfureux et sulfites" },
  { code: "LUPIN", label: "Lupin" },
  { code: "MOLLUSCS", label: "Mollusques" },
] as const;

export type AllergenCode = (typeof ALLERGENS)[number]["code"];
export const ALLERGEN_CODES = ALLERGENS.map((allergen) => allergen.code) as [AllergenCode, ...AllergenCode[]];

const LABELS = new Map<string, string>(ALLERGENS.map((allergen) => [allergen.code, allergen.label]));

/** Libellé français d'un code (le code lui-même s'il est inconnu). */
export function allergenLabel(code: string): string {
  return LABELS.get(code) ?? code;
}

/** Liste dans l'ordre réglementaire, sans doublon ni code inconnu. */
export function normalizeAllergens(codes: readonly string[]): AllergenCode[] {
  const wanted = new Set(codes);
  return ALLERGEN_CODES.filter((code) => wanted.has(code));
}

/**
 * Vue d'un produit : `null` = « Allergènes non renseignés » (jamais « Aucun allergène ») ;
 * liste vide = « Aucun allergène » (déclaré par l'administrateur) ; sinon les allergènes présents.
 */
export function productAllergens(product: { allergens: readonly string[]; allergensDeclared: boolean }): AllergenCode[] | null {
  return product.allergensDeclared ? normalizeAllergens(product.allergens) : null;
}

/** Valeurs à écrire en base pour une saisie : `null` remet à « non renseignés ». */
export function allergenColumns(input: readonly string[] | null): { allergens: AllergenCode[]; allergensDeclared: boolean } {
  return input === null ? { allergens: [], allergensDeclared: false } : { allergens: normalizeAllergens(input), allergensDeclared: true };
}

/** Texte affiché au client. */
export function allergenSummary(allergens: readonly string[] | null): string {
  if (allergens === null) return "Allergènes non renseignés";
  if (allergens.length === 0) return "Aucun allergène";
  return allergens.map(allergenLabel).join(", ");
}
