import { z } from "zod";

/**
 * Lot 2, demande 1 — boutiques de l'entreprise, saisies par l'administrateur : nom, adresse, consignes
 * d'accès et tournée (une boutique est livrée le matin de sa tournée, décision de Théo du 18 novembre).
 * L'entreprise vient toujours de la session.
 */
const text = (label: string, max: number) => z.string().trim().max(max, `${label} : ${max} caractères au plus.`);
const optionalText = (label: string, max: number) =>
  text(label, max).nullable().transform((value) => (value ? value : null)).optional();
const required = (label: string, max: number) => text(label, max).min(1, `${label} : obligatoire.`);

const shopFields = {
  name: required("Nom du point de vente", 160),
  address: required("Adresse", 240),
  postalCode: optionalText("Code postal", 12),
  city: optionalText("Ville", 120),
  latitude: z.number().min(-90).max(90).nullable().optional(),
  longitude: z.number().min(-180).max(180).nullable().optional(),
  accessInstructions: optionalText("Consignes d'accès", 500),
  contactPhone: optionalText("Téléphone", 40),
  zoneId: z.string().trim().min(1, "Choisissez la tournée du point de vente.").max(64),
};

/** Lot 2, demande 4 : code responsable de la tablette, 4 à 8 chiffres. */
export const managerCodeSchema = z.string().trim().regex(/^\d{4,8}$/, "Code responsable : 4 à 8 chiffres.");

export const createShopSchema = z
  .object({ ...shopFields, managerCode: managerCodeSchema })
  .strict()
  .refine((value) => (value.latitude == null) === (value.longitude == null), "Position incomplète.");

export const updateShopSchema = z
  .object({ ...shopFields, active: z.boolean() })
  .partial()
  .strict()
  .refine((value) => Object.keys(value).length > 0, "Rien à modifier.")
  .refine((value) => (value.latitude === undefined) === (value.longitude === undefined), "Position incomplète.");

export const setManagerCodeSchema = z.object({ code: managerCodeSchema }).strict();
export const unlockShopPricesSchema = z.object({ code: z.string().trim().min(1, "Saisissez le code responsable.").max(8) }).strict();
export const changeManagerCodeSchema = z
  .object({ currentCode: z.string().trim().min(1).max(8), newCode: managerCodeSchema })
  .strict();

/** Lot 2, demande 4 : prix boutique TTC en centimes ; un produit vendu a un prix, un produit non vendu n'en a pas. */
const shopPriceSchema = z
  .object({
    productId: z.string().trim().min(1).max(64),
    sizeId: z.string().trim().min(1).max(64).nullable(),
    sold: z.boolean(),
    priceCents: z.number().int("Prix en centimes entiers.").min(1, "Le prix doit être positif.").max(10_000_000, "Prix trop élevé.").nullable(),
  })
  .strict()
  .refine((value) => !value.sold || value.priceCents !== null, { message: "Saisissez le prix, ou marquez le produit « non vendu ».", path: ["priceCents"] });
export const shopPricesSchema = z.object({ prices: z.array(shopPriceSchema).min(1).max(1000) }).strict();
export const sellerShopPricesSchema = z.object({ code: z.string().trim().min(1).max(8), prices: z.array(shopPriceSchema).min(1).max(1000) }).strict();

export type CreateShopInput = z.infer<typeof createShopSchema>;
export type UpdateShopInput = z.infer<typeof updateShopSchema>;
