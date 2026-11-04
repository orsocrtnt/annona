import { z } from "zod";

/** MAIL-PONT, étape 4 : nouvelle fiche client saisie par l'équipe à la validation d'une commande reçue. */
export const newCompanyCustomerSchema = z
  .object({
    name: z.string().trim().min(1, "Nom du client requis.").max(120, "Nom trop long."),
    email: z.string().trim().toLowerCase().max(254).email("Adresse e-mail du client invalide."),
    phone: z.string().trim().max(40).optional().nullable(),
  })
  .strict();

export type NewCompanyCustomer = z.infer<typeof newCompanyCustomerSchema>;
