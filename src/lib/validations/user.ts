import { z } from "zod";
import { MINI_ADMIN_MODULE_IDS } from "@/lib/permissions/mini-admin";

export const updateProfileSchema = z.object({
  firstName: z.string().min(2, "Le prénom doit contenir au moins 2 caractères"),
  lastName: z.string().min(2, "Le nom doit contenir au moins 2 caractères"),
  phone: z.string().optional(),
  avatarUrl: z.string().url().optional().or(z.literal("")),
});

const miniAdminModuleSchema = z.enum(MINI_ADMIN_MODULE_IDS);

export const createUserSchema = z
  .object({
    firstName: z.string().min(2, "Le prénom doit contenir au moins 2 caractères"),
    lastName: z.string().min(2, "Le nom doit contenir au moins 2 caractères"),
    email: z.string().email("Format d'email invalide"),
    roleSlug: z.enum(["client", "driver", "mini-admin"], {
      message: "Rôle invalide",
    }),
    miniAdminTitle: z.string().optional(),
    miniAdminModules: z.array(miniAdminModuleSchema).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.roleSlug !== "mini-admin") return;

    const title = data.miniAdminTitle?.trim() ?? "";
    if (title.length < 2) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["miniAdminTitle"],
        message: "Donnez un nom au mini-admin (au moins 2 caractères)",
      });
    }

    if (!data.miniAdminModules?.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["miniAdminModules"],
        message: "Choisissez au moins un accès",
      });
    }
  });

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
export type CreateUserInput = z.infer<typeof createUserSchema>;
