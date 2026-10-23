import { z } from "zod";

const optionalText = (schema: z.ZodString) => schema.optional().or(z.literal(""));

const identityPersonFields = {
  firstName: z.string().trim().min(2, "Le prénom doit contenir au moins 2 caractères.").max(80),
  lastName: z.string().trim().min(2, "Le nom doit contenir au moins 2 caractères.").max(80),
  email: z.string().trim().email("Indiquez une adresse e-mail professionnelle valide.").max(254),
};

const identityCompanyFields = {
  companyName: z.string().trim().min(2, "Le nom commercial doit contenir au moins 2 caractères.").max(160),
  legalName: optionalText(z.string().trim().max(200)),
  siren: optionalText(z.string().trim().regex(/^\d{9}$/, "Le SIREN doit contenir 9 chiffres.")),
  siret: optionalText(z.string().trim().regex(/^\d{14}$/, "Le SIRET doit contenir 14 chiffres.")),
  phone: optionalText(z.string().trim().max(30)),
  billingAddress: z.string().trim().min(5, "L’adresse de facturation doit contenir au moins 5 caractères.").max(240),
  billingPostalCode: z.string().trim().min(2, "Indiquez le code postal.").max(20),
  billingCity: z.string().trim().min(2, "Indiquez la ville.").max(120),
  billingCountry: z.string().trim().length(2, "Le pays s’écrit en 2 lettres, par exemple FR.").default("FR"),
};

const identitySiretRefine = (value: { siret?: string; siren?: string }) => !value.siret || !value.siren || value.siret.startsWith(value.siren);
const identitySiretIssue = { message: "Le SIRET doit commencer par le SIREN indiqué.", path: ["siret"] };

const optionSelection = z.object({
  code: z.string().trim().min(1).max(80),
  quantity: z.number().int().min(1).max(500),
});

const signupSelectionFields = {
  planCode: z.enum(["STARTER", "PRO", "BUSINESS"]),
  billingInterval: z.enum(["MONTHLY", "ANNUAL"]),
  optionSelections: z.array(optionSelection).max(20).default([]),
};

export const signupSelectionSchema = z.union([
  z.object({ action: z.literal("create"), ...signupSelectionFields }),
  z.object({ action: z.literal("selection"), ...signupSelectionFields }),
]);

export const signupIdentitySchema = z.object({
  action: z.literal("identity"),
  ...identityPersonFields,
  password: z.string()
    .min(8, "Le mot de passe doit contenir au moins 8 caractères.")
    .max(128)
    .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, "Le mot de passe doit contenir une minuscule, une majuscule et un chiffre."),
  ...identityCompanyFields,
}).refine(identitySiretRefine, identitySiretIssue);

export const signupIdentityDetailsSchema = z.object({
  action: z.literal("identity-details"),
  ...identityPersonFields,
  ...identityCompanyFields,
}).refine(identitySiretRefine, identitySiretIssue);

export function describeSignupValidation(error: z.ZodError) {
  const fields: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path[0];
    if (typeof key === "string" && key && !fields[key]) fields[key] = issue.message;
  }
  const messages = Object.values(fields);
  return {
    fields,
    summary: messages.length === 0
      ? "Vérifiez les informations saisies."
      : messages.length === 1
        ? messages[0] ?? "Vérifiez les informations saisies."
        : `Corrigez ${messages.length} informations : ${messages.join(" ")}`,
  };
}

export const signupResendEmailSchema = z.object({ action: z.literal("resend-email") });
export const signupEditIdentitySchema = z.object({ action: z.literal("edit-identity") });

export const signupActionSchema = z.union([
  signupSelectionSchema,
  signupIdentitySchema,
  signupIdentityDetailsSchema,
  signupResendEmailSchema,
  signupEditIdentitySchema,
]);

export const fakePaymentSchema = z.object({
  eventKey: z.string().uuid(),
  outcome: z.enum(["confirmed", "declined", "pending"]).default("confirmed"),
});
