import { z } from "zod";

export const updateProfileSchema = z.object({
  firstName: z.string().min(2, "Le prénom doit contenir au moins 2 caractères"),
  lastName: z.string().min(2, "Le nom doit contenir au moins 2 caractères"),
  phone: z.string().optional(),
  avatarUrl: z.string().url().optional().or(z.literal("")),
});

/** Rôles qu'un administrateur peut ouvrir (slugs de `prisma/reference-data.ts`). */
export const CREATABLE_ROLE_SLUGS = ["admin", "baker", "driver", "merchant"] as const;

export const createUserSchema = z.object({
  firstName: z.string().min(2, "Le prénom doit contenir au moins 2 caractères"),
  lastName: z.string().min(2, "Le nom doit contenir au moins 2 caractères"),
  email: z.string().email("Format d'email invalide"),
  roleSlug: z.enum(CREATABLE_ROLE_SLUGS, { message: "Rôle invalide" }),
});

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
export type CreateUserInput = z.infer<typeof createUserSchema>;
