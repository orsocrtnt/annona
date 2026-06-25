import { z } from "zod";

export const customerAddressSchema = z.object({
  label: z.string().min(2, "Libellé requis"),
  address: z.string().min(5, "Adresse requise"),
  city: z.string().min(2, "Ville requise"),
  postalCode: z.string().min(4, "Code postal requis"),
  isDefault: z.boolean().optional(),
});

export type CustomerAddressInput = z.infer<typeof customerAddressSchema>;
