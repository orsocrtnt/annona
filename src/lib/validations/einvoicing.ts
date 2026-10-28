import { z } from "zod";

/** Texte facultatif : espaces retirés, chaîne vide → absent. */
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((value) => (value ? value : undefined));

const compact = (value: string | undefined) => (value ? value.replace(/\s+/g, "").toUpperCase() : undefined);

/** Clé de TVA française : FR + clé (2 chiffres) + SIREN. */
export function frenchVatNumberForSiren(siren: string): string {
  const key = (12 + 3 * (Number(siren) % 97)) % 97;
  return `FR${String(key).padStart(2, "0")}${siren}`;
}

export function isValidIban(iban: string): boolean {
  const value = iban.replace(/\s+/g, "").toUpperCase();
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$/.test(value)) return false;
  const rearranged = value.slice(4) + value.slice(0, 4);
  let remainder = 0;
  for (const char of rearranged) {
    const digits = /[A-Z]/.test(char) ? String(char.charCodeAt(0) - 55) : char;
    for (const digit of digits) remainder = (remainder * 10 + Number(digit)) % 97;
  }
  return remainder === 1;
}

const vatNumber = optionalText(20)
  .transform(compact)
  .refine((value) => !value || /^[A-Z]{2}[0-9A-Z]{2,13}$/.test(value), "Le n° de TVA commence par le code pays, par exemple FR12345678901.");

const sirenField = optionalText(20)
  .transform((value) => value?.replace(/\s+/g, ""))
  .refine((value) => !value || /^\d{9}$/.test(value), "Le SIREN doit contenir 9 chiffres.");

/** Mentions légales et paramètres Factur-X de l'entreprise émettrice (Company.settings.einvoicing). */
export const einvoicingSettingsSchema = z.object({
  vatNumber,
  legalForm: optionalText(60),
  shareCapital: optionalText(40),
  rcs: optionalText(120),
  iban: optionalText(42)
    .transform(compact)
    .refine((value) => !value || isValidIban(value), "IBAN invalide (vérifiez la clé)."),
  bic: optionalText(11)
    .transform(compact)
    .refine((value) => !value || /^[A-Z]{4}[A-Z]{2}[A-Z0-9]{2}([A-Z0-9]{3})?$/.test(value), "BIC invalide (8 ou 11 caractères)."),
  paymentTermsText: optionalText(300),
  latePenaltyText: optionalText(500),
  earlyPaymentDiscountText: optionalText(300),
  vatExemptionReason: optionalText(300),
});

/** Identité légale de l'entreprise (colonnes Company existantes). */
export const companyLegalIdentitySchema = z
  .object({
    legalName: optionalText(200),
    siren: sirenField,
    siret: optionalText(20)
      .transform((value) => value?.replace(/\s+/g, ""))
      .refine((value) => !value || /^\d{14}$/.test(value), "Le SIRET doit contenir 14 chiffres."),
    billingAddress: optionalText(240),
    billingPostalCode: optionalText(20),
    billingCity: optionalText(120),
    country: z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^[A-Z]{2}$/, "Le pays s’écrit en 2 lettres, par exemple FR.")
      .default("FR"),
  })
  .refine((value) => !value.siret || !value.siren || value.siret.startsWith(value.siren), {
    message: "Le SIRET doit commencer par le SIREN indiqué.",
    path: ["siret"],
  });

export const companyEinvoicingUpdateSchema = z
  .object({
    identity: companyLegalIdentitySchema,
    einvoicing: einvoicingSettingsSchema,
  })
  .refine(
    (value) =>
      !value.einvoicing.vatNumber?.startsWith("FR") ||
      !value.identity.siren ||
      value.einvoicing.vatNumber === frenchVatNumberForSiren(value.identity.siren),
    { message: "Le n° de TVA français ne correspond pas au SIREN (FR + clé + SIREN).", path: ["einvoicing", "vatNumber"] }
  );

/** Identité de facturation d'un client (User.settings.invoiceIdentity). */
export const clientInvoiceIdentitySchema = z.object({
  companyName: optionalText(200),
  siren: sirenField,
  vatNumber,
  address: z.string().trim().min(3, "Indiquez l’adresse de facturation.").max(240),
  postalCode: z.string().trim().min(2, "Indiquez le code postal.").max(20),
  city: z.string().trim().min(2, "Indiquez la ville.").max(120),
  countryCode: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z]{2}$/, "Le pays s’écrit en 2 lettres, par exemple FR.")
    .default("FR"),
});

export type EinvoicingSettings = z.infer<typeof einvoicingSettingsSchema>;
export type CompanyLegalIdentity = z.infer<typeof companyLegalIdentitySchema>;
export type CompanyEinvoicingUpdate = z.infer<typeof companyEinvoicingUpdateSchema>;
export type ClientInvoiceIdentity = z.infer<typeof clientInvoiceIdentitySchema>;

/** Lecture tolérante d'un JSON stocké : une valeur invalide est ignorée plutôt que de bloquer. */
export function parseStoredEinvoicingSettings(raw: unknown): EinvoicingSettings {
  const parsed = einvoicingSettingsSchema.safeParse(raw ?? {});
  return parsed.success ? parsed.data : einvoicingSettingsSchema.parse({});
}

export function parseStoredClientInvoiceIdentity(raw: unknown): ClientInvoiceIdentity | null {
  if (!raw) return null;
  const parsed = clientInvoiceIdentitySchema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}
