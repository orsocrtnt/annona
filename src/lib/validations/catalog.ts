import { z } from "zod";
import { ALLERGEN_CODES } from "@/domains/catalog/allergens";

/**
 * Saisies du back-office catalogue (CAT-1 : ADM-02, ADM-03, PLA-04). Montants en centimes HT,
 * TVA en points de base (550 = 5,5 %). Les libellés (unité, catégories) restent libres (PLA-04).
 */
const id = z.string().trim().min(1).max(64);
const name = (label: string) =>
  z.string().trim().min(1, `${label} : obligatoire.`).max(120, `${label} : 120 caractères au plus.`);
const cents = z
  .number({ error: "Saisissez un prix." })
  .int("Prix en centimes entiers.")
  .min(0, "Le prix ne peut pas être négatif.")
  .max(10_000_000, "Prix trop élevé.");

/** Lot 2, demande 2 : pain (boulanger) ou pâtisserie (pâtissier). */
export const PRODUCT_FAMILIES = ["BREAD", "PASTRY"] as const;
const family = z.enum(PRODUCT_FAMILIES);

export const createCategorySchema = z.object({ name: name("Nom"), family: family.optional() }).strict();

export const updateCategorySchema = z
  .object({ name: name("Nom").optional(), active: z.boolean().optional(), family: family.optional() })
  .strict()
  .refine((value) => value.name !== undefined || value.active !== undefined || value.family !== undefined, "Rien à modifier.");

export const reorderCategoriesSchema = z.object({ ids: z.array(id).min(1).max(500) }).strict();

/** Lot 2, demande 3 : petite pièce ou gros gâteau. */
export const PASTRY_FORMATS = ["SMALL", "LARGE"] as const;
/** Lot 2, demande 3 : jours de vente en boutique, jour de réception compris. */
export const shelfLifeDaysSchema = z
  .number({ error: "Saisissez une durée de vente en jours." })
  .int("Durée de vente en jours entiers.")
  .min(1, "Durée de vente : 1 jour au moins (le jour de réception).")
  .max(60, "Durée de vente : 60 jours au plus.");
const recipe = z.string().trim().max(10_000, "Recette : 10 000 caractères au plus.").nullable().transform((value) => (value ? value : null));
/** Taille d'un gros gâteau : nombre de parts, et prix restaurant HT de la taille (administrateur seulement). */
const sizeSchema = z
  .object({
    servings: z.number({ error: "Nombre de parts." }).int("Nombre de parts entier.").min(1, "1 part au moins.").max(100, "100 parts au plus."),
    restaurantPriceCents: cents.nullable().optional(),
  })
  .strict();
const sizes = z
  .array(sizeSchema)
  .max(12, "12 tailles au plus.")
  .refine((list) => new Set(list.map((size) => size.servings)).size === list.length, "Deux tailles ont le même nombre de parts.");

/** Lot 2, demande 3 : un gros gâteau a au moins une taille ; une petite pièce ou du pain n'en a pas. */
function sizesMatchFormat(value: { pastryFormat?: "SMALL" | "LARGE" | null; sizes?: Array<{ servings: number }> }) {
  if (value.pastryFormat === "LARGE") return value.sizes === undefined || value.sizes.length > 0;
  return !value.sizes || value.sizes.length === 0;
}
const SIZES_MESSAGE = { message: "Un gros gâteau a au moins une taille ; une petite pièce n'en a pas.", path: ["sizes"] };

const productFields = {
  name: name("Nom"),
  description: z.string().trim().max(500, "Description : 500 caractères au plus.").nullable().optional(),
  categoryId: id,
  unit: name("Unité").pipe(z.string().max(40, "Unité : 40 caractères au plus.")),
  /** Prix restaurant HT ; lot 2, demande 4 : vide = pas encore saisi (absent du catalogue des restaurants). */
  basePriceCents: cents.nullable(),
  vatRateBasisPoints: z
    .number({ error: "Saisissez un taux de TVA." })
    .int()
    .min(0, "Taux de TVA invalide.")
    .max(10_000, "Taux de TVA invalide."),
  active: z.boolean(),
  /**
   * Lot 1, demande 3 : allergènes présents ; `[]` = « Aucun allergène » (déclaré), `null` = non renseignés.
   * Absent : inchangé.
   */
  allergens: z.array(z.enum(ALLERGEN_CODES)).max(ALLERGEN_CODES.length).nullable().optional(),
  /** Lot 2, demande 3 : pâtisserie seulement (vide pour le pain). */
  pastryFormat: z.enum(PASTRY_FORMATS).nullable().optional(),
  sizes: sizes.optional(),
  recipe: recipe.optional(),
  shelfLifeDays: shelfLifeDaysSchema.optional(),
};

export const createProductSchema = z.object(productFields).strict().refine(sizesMatchFormat, SIZES_MESSAGE);
export const updateProductSchema = z.object(productFields).partial().strict().refine(sizesMatchFormat, SIZES_MESSAGE);

/**
 * Lot 2, demande 3 : fiche saisie par le pâtissier. Aucun prix (le prix restaurant est fixé par l'administrateur,
 * le prix boutique par la responsable de chaque boutique) ; format obligatoire ; tailles d'un gros gâteau en parts.
 */
const pastryFields = {
  name: name("Nom"),
  description: z.string().trim().max(500, "Description : 500 caractères au plus.").nullable().optional(),
  categoryId: id,
  unit: name("Unité").pipe(z.string().max(40, "Unité : 40 caractères au plus.")),
  pastryFormat: z.enum(PASTRY_FORMATS),
  servings: z.array(z.number().int().min(1, "1 part au moins.").max(100, "100 parts au plus.")).max(12).optional(),
  allergens: z.array(z.enum(ALLERGEN_CODES)).max(ALLERGEN_CODES.length).nullable().optional(),
  recipe: recipe.optional(),
  shelfLifeDays: shelfLifeDaysSchema,
  active: z.boolean().optional(),
};
const servingsMatchFormat = (value: { pastryFormat?: "SMALL" | "LARGE"; servings?: number[] }) =>
  value.pastryFormat === "LARGE"
    ? value.servings === undefined || (value.servings.length > 0 && new Set(value.servings).size === value.servings.length)
    : !value.servings || value.servings.length === 0;
const SERVINGS_MESSAGE = { message: "Un gros gâteau a au moins une taille (sans doublon) ; une petite pièce n'en a pas.", path: ["servings"] };
export const createPastryProductSchema = z.object(pastryFields).strict().refine(servingsMatchFormat, SERVINGS_MESSAGE);
export const updatePastryProductSchema = z.object(pastryFields).partial().strict().refine(servingsMatchFormat, SERVINGS_MESSAGE);

/** Lot 2, demande 3 : le boulanger (ou l'administrateur) règle la durée de vente du pain. */
export const updateShelfLifeSchema = z.object({ shelfLifeDays: shelfLifeDaysSchema }).strict();

export const upsertMerchantPriceSchema = z
  .object({ merchantId: id, productId: id, priceCents: cents })
  .strict();

/**
 * Lot 1, demande 2 : promotion sur un produit. Prix promo (centimes HT) OU réduction en % entier ;
 * date de fin incluse ; quantité limitée facultative (tous clients) ; tous les clients ou certains.
 */
export const createPromotionSchema = z
  .object({
    productId: id,
    promoPriceCents: cents.nullable().optional(),
    discountPercent: z
      .number({ error: "Saisissez une réduction." })
      .int("Réduction en pourcentage entier.")
      .min(1, "Réduction : entre 1 et 99 %.")
      .max(99, "Réduction : entre 1 et 99 %.")
      .nullable()
      .optional(),
    endsOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date de fin invalide."),
    quantityLimit: z
      .number({ error: "Saisissez une quantité." })
      .int("Quantité entière.")
      .min(1, "Quantité limitée : au moins 1.")
      .max(1_000_000, "Quantité trop élevée.")
      .nullable()
      .optional(),
    allMerchants: z.boolean(),
    merchantIds: z.array(id).max(1000).optional(),
  })
  .strict()
  .refine((value) => (typeof value.promoPriceCents === "number") !== (typeof value.discountPercent === "number"), {
    message: "Indiquez un prix promo ou une réduction en pourcentage.",
  })
  .refine((value) => value.allMerchants || (value.merchantIds?.length ?? 0) > 0, {
    message: "Choisissez au moins un client.",
  });

export type CreatePromotionInput = z.infer<typeof createPromotionSchema>;
export type CreateCategoryInput = z.infer<typeof createCategorySchema>;
export type UpdateCategoryInput = z.infer<typeof updateCategorySchema>;
export type CreateProductInput = z.infer<typeof createProductSchema>;
export type UpdateProductInput = z.infer<typeof updateProductSchema>;
export type UpsertMerchantPriceInput = z.infer<typeof upsertMerchantPriceSchema>;

/** « 1,10 » ou « 1.10 » (euros) → 110 centimes ; `null` si la saisie n'est pas un montant. */
export function parseEurosToCents(value: string): number | null {
  const normalized = value.trim().replace(/\s/g, "").replace(",", ".");
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) return null;
  return Math.round(Number(normalized) * 100);
}

/** « 5,5 » (%) → 550 points de base ; `null` si invalide. */
export function parsePercentToBasisPoints(value: string): number | null {
  const normalized = value.trim().replace(",", ".");
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) return null;
  const basisPoints = Math.round(Number(normalized) * 100);
  return basisPoints <= 10_000 ? basisPoints : null;
}
export type CreatePastryProductInput = z.infer<typeof createPastryProductSchema>;
export type UpdatePastryProductInput = z.infer<typeof updatePastryProductSchema>;
