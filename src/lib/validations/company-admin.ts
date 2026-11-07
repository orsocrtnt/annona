import { z } from "zod";

/**
 * ADM-1 — saisies de l'administrateur de l'entreprise (clients, comptes, paramètres, créneaux) et du
 * super-administrateur (entreprises). L'entreprise ne vient jamais de ces saisies : toujours de la session.
 */
const text = (label: string, max: number) => z.string().trim().max(max, `${label} : ${max} caractères au plus.`);
/** Absent : inchangé (undefined) ; vide : effacé (null). */
const optionalText = (label: string, max: number) =>
  text(label, max).nullable().transform((value) => (value ? value : null)).optional();
const required = (label: string, max: number) => text(label, max).min(1, `${label} : obligatoire.`);
const email = (label: string) =>
  z.string().trim().max(200).email(`${label} : adresse invalide.`).nullable().optional().or(z.literal("").transform(() => null));
const hhmm = (label: string) => z.string().trim().regex(/^([01]\d|2[0-3]):[0-5]\d$/, `${label} : format HH:MM.`);

export const BILLING_PERIODS = ["DAILY", "WEEKLY", "MONTHLY", "YEARLY"] as const;
export const PAYMENT_METHODS = ["VIREMENT", "PRELEVEMENT", "ESPECES"] as const;

// ---------------------------------------------------------------------------
// Clients (commerçants)
// ---------------------------------------------------------------------------

const merchantFields = {
  name: required("Raison sociale", 160),
  tradeName: optionalText("Enseigne", 160),
  siren: z
    .string()
    .trim()
    .regex(/^\d{9}$/, "SIREN : 9 chiffres.")
    .nullable()
    .optional()
    .or(z.literal("").transform(() => null)),
  vatNumber: optionalText("N° de TVA", 40),
  address: required("Adresse", 240),
  postalCode: optionalText("Code postal", 12),
  city: optionalText("Ville", 120),
  latitude: z.number().min(-90).max(90).nullable().optional(),
  longitude: z.number().min(-180).max(180).nullable().optional(),
  accessInstructions: optionalText("Consignes d'accès", 600),
  contactName: optionalText("Contact", 120),
  contactPhone: optionalText("Téléphone", 40),
  contactEmail: email("E-mail du contact"),
  billingEmail: email("E-mail de facturation"),
  billingAddress: optionalText("Adresse de facturation", 240),
  billingPostalCode: optionalText("Code postal de facturation", 12),
  billingCity: optionalText("Ville de facturation", 120),
  billingPeriod: z.enum(BILLING_PERIODS),
  paymentMethod: z.enum(PAYMENT_METHODS).nullable().optional(),
};

export const createMerchantSchema = z
  .object(merchantFields)
  .strict()
  .refine((value) => (value.latitude == null) === (value.longitude == null), "Position incomplète.");

export const updateMerchantSchema = z
  .object({ ...merchantFields, active: z.boolean() })
  .partial()
  .strict()
  .refine((value) => Object.keys(value).length > 0, "Rien à modifier.")
  .refine((value) => (value.latitude === undefined) === (value.longitude === undefined), "Position incomplète.");

export type CreateMerchantInput = z.infer<typeof createMerchantSchema>;
export type UpdateMerchantInput = z.infer<typeof updateMerchantSchema>;

// ---------------------------------------------------------------------------
// Comptes (ADM-01)
// ---------------------------------------------------------------------------

export const ACCOUNT_ROLE_SLUGS = ["admin", "baker", "driver", "merchant"] as const;

export const updateAccountSchema = z
  .object({
    firstName: required("Prénom", 80).optional(),
    lastName: required("Nom", 80).optional(),
    phone: optionalText("Téléphone", 40),
    roleSlug: z.enum(ACCOUNT_ROLE_SLUGS).optional(),
    merchantId: z.string().trim().min(1).max(64).nullable().optional(),
    /** Désactiver (false) ou réactiver (true) le compte. */
    active: z.boolean().optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, "Rien à modifier.");

export type UpdateAccountInput = z.infer<typeof updateAccountSchema>;
/** Saisie côté navigateur (avant normalisation). */
export type UpdateAccountRequest = z.input<typeof updateAccountSchema>;

// ---------------------------------------------------------------------------
// Paramètres (ADM-09, PLA-03, PLA-04)
// ---------------------------------------------------------------------------

export const COMPANY_TIMEZONES = ["Europe/Paris", "Europe/Brussels", "Europe/Luxembourg", "Europe/Zurich", "Europe/Monaco", "America/Martinique", "America/Guadeloupe", "Indian/Reunion", "America/Cayenne", "Indian/Mayotte", "Pacific/Noumea", "Pacific/Tahiti"] as const;

export const companySettingsSchema = z
  .object({
    name: required("Nom de l'entreprise", 120),
    cutoffTime: hhmm("Heure limite"),
    timezone: z.enum(COMPANY_TIMEZONES, { message: "Fuseau horaire non pris en charge." }),
    reminderLeadMinutes: z
      .number({ error: "Délai du rappel : nombre de minutes." })
      .int()
      .min(0, "Délai du rappel : 0 minute au moins (0 = pas de rappel).")
      .max(1440, "Délai du rappel : 24 h au plus."),
    /** PLA-04 : unités proposées à la saisie d'un produit (l'unité reste libre). */
    units: z.array(required("Unité", 40)).max(30, "30 unités au plus.").default([]),
  })
  .partial()
  .strict()
  .refine((value) => Object.keys(value).length > 0, "Rien à modifier.");

export type CompanySettingsInput = z.infer<typeof companySettingsSchema>;

const slotFields = {
  label: optionalText("Nom du créneau", 60),
  startTime: hhmm("Début"),
  endTime: hhmm("Fin"),
};

export const createSlotSchema = z
  .object(slotFields)
  .strict()
  .refine((value) => value.startTime < value.endTime, { message: "La fin du créneau doit suivre son début.", path: ["endTime"] });

export const updateSlotSchema = z
  .object({ ...slotFields, active: z.boolean() })
  .partial()
  .strict()
  .refine((value) => Object.keys(value).length > 0, "Rien à modifier.");

export const reorderSlotsSchema = z.object({ ids: z.array(z.string().trim().min(1).max(64)).min(1).max(50) }).strict();

export type CreateSlotInput = z.infer<typeof createSlotSchema>;
export type UpdateSlotInput = z.infer<typeof updateSlotSchema>;

// ---------------------------------------------------------------------------
// Super-administrateur (PLA-02)
// ---------------------------------------------------------------------------

export const createCompanySchema = z
  .object({
    name: required("Nom de l'entreprise", 120),
    cutoffTime: hhmm("Heure limite").default("17:00"),
    timezone: z.enum(COMPANY_TIMEZONES).default("Europe/Paris"),
    reminderLeadMinutes: z.number().int().min(0).max(1440).default(120),
    admin: z
      .object({
        firstName: required("Prénom", 80),
        lastName: required("Nom", 80),
        email: z.string().trim().toLowerCase().email("E-mail de l'administrateur : adresse invalide.").max(200),
      })
      .strict(),
  })
  .strict();

export const configureCompanySchema = z
  .object({
    name: required("Nom de l'entreprise", 120),
    cutoffTime: hhmm("Heure limite"),
    timezone: z.enum(COMPANY_TIMEZONES),
    reminderLeadMinutes: z.number().int().min(0).max(1440),
  })
  .partial()
  .strict()
  .refine((value) => Object.keys(value).length > 0, "Rien à modifier.");

export type CreateCompanyInput = z.infer<typeof createCompanySchema>;
export type ConfigureCompanyInput = z.infer<typeof configureCompanySchema>;
