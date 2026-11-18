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
  name: required("Nom de la boutique", 160),
  address: required("Adresse", 240),
  postalCode: optionalText("Code postal", 12),
  city: optionalText("Ville", 120),
  latitude: z.number().min(-90).max(90).nullable().optional(),
  longitude: z.number().min(-180).max(180).nullable().optional(),
  accessInstructions: optionalText("Consignes d'accès", 500),
  contactPhone: optionalText("Téléphone", 40),
  zoneId: z.string().trim().min(1, "Choisissez la tournée de la boutique.").max(64),
};

export const createShopSchema = z
  .object(shopFields)
  .strict()
  .refine((value) => (value.latitude == null) === (value.longitude == null), "Position incomplète.");

export const updateShopSchema = z
  .object({ ...shopFields, active: z.boolean() })
  .partial()
  .strict()
  .refine((value) => Object.keys(value).length > 0, "Rien à modifier.")
  .refine((value) => (value.latitude === undefined) === (value.longitude === undefined), "Position incomplète.");

export type CreateShopInput = z.infer<typeof createShopSchema>;
export type UpdateShopInput = z.infer<typeof updateShopSchema>;
