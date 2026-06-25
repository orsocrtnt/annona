import { z } from "zod";

export const tariffZoneSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1, "Le nom de la zone est requis"),
  postalCodePrefixes: z
    .array(z.string().min(1))
    .min(1, "Au moins un préfixe postal est requis"),
  price: z.number().min(0, "Le tarif doit être positif ou nul"),
});

export const tariffFeeSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1, "Le nom du supplément est requis"),
  price: z.number().min(0, "Le tarif doit être positif ou nul"),
  description: z.string().optional(),
});

export const companyTariffSettingsSchema = z.object({
  tariffZones: z.array(tariffZoneSchema),
  tariffFees: z.array(tariffFeeSchema),
});

export type TariffZone = z.infer<typeof tariffZoneSchema>;
export type TariffFee = z.infer<typeof tariffFeeSchema>;
export type CompanyTariffSettings = z.infer<typeof companyTariffSettingsSchema>;
