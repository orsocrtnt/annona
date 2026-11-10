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

export const createCategorySchema = z.object({ name: name("Nom") }).strict();

export const updateCategorySchema = z
  .object({ name: name("Nom").optional(), active: z.boolean().optional() })
  .strict()
  .refine((value) => value.name !== undefined || value.active !== undefined, "Rien à modifier.");

export const reorderCategoriesSchema = z.object({ ids: z.array(id).min(1).max(500) }).strict();

const productFields = {
  name: name("Nom"),
  description: z.string().trim().max(500, "Description : 500 caractères au plus.").nullable().optional(),
  categoryId: id,
  unit: name("Unité").pipe(z.string().max(40, "Unité : 40 caractères au plus.")),
  basePriceCents: cents,
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
};

export const createProductSchema = z.object(productFields).strict();
export const updateProductSchema = z.object(productFields).partial().strict();

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
