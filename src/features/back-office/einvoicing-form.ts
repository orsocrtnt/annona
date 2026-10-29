import { checkSellerAdvisories, checkSellerReadiness, type ReadinessAdvisory, type ReadinessGroup, type ReadinessIssue } from "@/domains/invoice/facturx/facturx-readiness";
import { companyEinvoicingUpdateSchema, readinessFieldErrors, zodFieldErrors, type FieldErrors } from "@/lib/validations/einvoicing";

export type EinvoicingFieldKey =
  | "legalName" | "siren" | "siret" | "billingAddress" | "billingPostalCode" | "billingCity" | "country"
  | "vatNumber" | "taxRegistrationId" | "legalForm" | "shareCapital" | "rcs" | "iban" | "bic"
  | "paymentTermsText" | "latePenaltyText" | "earlyPaymentDiscountText" | "vatExemptionReason";

export const IDENTITY_KEYS: EinvoicingFieldKey[] = ["legalName", "siren", "siret", "billingAddress", "billingPostalCode", "billingCity", "country"];

export const groupOf = (key: string): ReadinessGroup => ((IDENTITY_KEYS as string[]).includes(key) ? "identity" : "einvoicing");

export function buildEinvoicingBody(values: Record<string, string>, enabled: boolean) {
  const body = { identity: {} as Record<string, string>, einvoicing: {} as Record<string, string | boolean> };
  for (const [key, value] of Object.entries(values)) body[groupOf(key)][key] = value;
  if (!body.identity.country) body.identity.country = "FR";
  body.einvoicing.enabled = enabled;
  return body;
}

export interface FormEvaluation {
  /** Message par champ, affiché sous le champ. Format invalide toujours ; mentions manquantes seulement si `enforced`. */
  errors: FieldErrors;
  /** Mentions qui manqueraient à l'export (liste d'information, bloquante seulement si `enforced`). */
  missing: ReadinessIssue[];
  /** Avertissements non bloquants (TVA / exonération), affichés sous le champ concerné. */
  advisories: ReadinessAdvisory[];
}

/** Mêmes règles que le serveur : schéma Zod de la route et checkSellerReadiness, sans copie. */
export function evaluateEinvoicingForm(values: Record<string, string>, enabled: boolean, enforced: boolean, vatRate?: number): FormEvaluation {
  const body = buildEinvoicingBody(values, enabled);
  const parsed = companyEinvoicingUpdateSchema.safeParse(body);
  const errors: FieldErrors = parsed.success ? {} : zodFieldErrors(parsed.error);
  const missing = checkSellerReadiness({ identity: body.identity, einvoicing: body.einvoicing as Record<string, string>, vatRate });
  if (enforced) for (const [field, message] of Object.entries(readinessFieldErrors(missing))) errors[field] ??= message;
  const advisories = checkSellerAdvisories({ einvoicing: body.einvoicing as Record<string, string>, vatRate });
  return { errors, missing, advisories };
}
