import { z } from "zod";

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
};

export const createProductSchema = z.object(productFields).strict();
export const updateProductSchema = z.object(productFields).partial().strict();

export const upsertMerchantPriceSchema = z
  .object({ merchantId: id, productId: id, priceCents: cents })
  .strict();

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
