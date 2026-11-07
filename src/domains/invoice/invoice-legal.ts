/**
 * FACT-1 — mentions légales d'une facture de période (ENF-05 ; art. L441-9 et D441-5 du Code de
 * commerce, art. 242 nonies A de l'annexe II du CGI).
 *
 * Toutes les mentions viennent des paramètres de l'entreprise (colonnes `Company` et
 * `settings.einvoicing`) et de la fiche du commerçant. Une mention absente n'est JAMAIS inventée :
 * elle est omise du PDF et signalée à l'administrateur (`invoiceLegalGaps`), avec le lien du champ à
 * compléter. Seules l'indemnité forfaitaire de 40 € (montant fixé par l'art. D441-5) et la date
 * d'échéance (calculée avec le délai des réglages de facturation) sont produites par l'application.
 *
 * Fonctions pures : utilisées par le PDF, la fiche facture et la liste du back-office.
 */
import { einvoicingFieldPath } from "@/domains/invoice/facturx/facturx-readiness";
import { RECOVERY_INDEMNITY_NOTE } from "@/domains/invoice/facturx/facturx-mapping";
import type { InvoicePdfLegalMentions } from "@/lib/pdf/invoice-pdf";
import type { EinvoicingSettings } from "@/lib/validations/einvoicing";

export interface InvoiceSeller {
  name: string;
  legalName: string | null;
  siren: string | null;
  siret: string | null;
  email: string | null;
  billingAddress: string | null;
  billingPostalCode: string | null;
  billingCity: string | null;
  country: string | null;
}

export interface InvoiceBuyer {
  name: string;
  siren: string | null;
  vatNumber: string | null;
  address: string;
  postalCode: string | null;
  city: string | null;
}

export interface InvoiceLegalGap {
  /** Champ du formulaire « Mentions légales et Factur-X » (Réglages › Facturation). */
  field: string;
  label: string;
  /** Lien direct vers le champ à compléter. */
  href: string;
}

const present = (value: string | null | undefined): value is string => Boolean(value && value.trim());

const gap = (field: string, label: string): InvoiceLegalGap => ({ field, label, href: einvoicingFieldPath(field) });

/**
 * Mentions obligatoires absentes des paramètres de l'entreprise. `hasVat` : au moins une ligne
 * soumise à TVA (n° de TVA exigé) ; `hasExempt` : au moins une ligne à 0 % (motif d'exonération exigé).
 */
export function invoiceLegalGaps(
  seller: InvoiceSeller,
  einvoicing: EinvoicingSettings,
  options: { hasVat: boolean; hasExempt: boolean }
): InvoiceLegalGap[] {
  const gaps: InvoiceLegalGap[] = [];
  if (!present(seller.legalName)) gaps.push(gap("legalName", "Raison sociale"));
  if (!present(seller.siren)) gaps.push(gap("siren", "SIREN"));
  if (!present(seller.billingAddress) || !present(seller.billingPostalCode) || !present(seller.billingCity)) {
    gaps.push(gap("billingAddress", "Adresse du siège (rue, code postal, ville)"));
  }
  if (options.hasVat && !present(einvoicing.vatNumber)) gaps.push(gap("vatNumber", "N° de TVA intracommunautaire"));
  if (!present(einvoicing.legalForm) || !present(einvoicing.shareCapital)) gaps.push(gap("legalForm", "Forme juridique et capital social"));
  if (!present(einvoicing.rcs)) gaps.push(gap("rcs", "Immatriculation RCS ou RM (ville)"));
  if (!present(einvoicing.latePenaltyText)) gaps.push(gap("latePenaltyText", "Taux des pénalités de retard"));
  if (!present(einvoicing.earlyPaymentDiscountText)) gaps.push(gap("earlyPaymentDiscountText", "Conditions d'escompte"));
  if (options.hasExempt && !present(einvoicing.vatExemptionReason)) gaps.push(gap("vatExemptionReason", "Motif d'exonération de TVA"));
  return gaps;
}

const parisDay = new Intl.DateTimeFormat("fr-FR", { timeZone: "Europe/Paris", day: "2-digit", month: "2-digit", year: "numeric" });

/** Conditions de paiement : texte des réglages, sinon l'échéance calculée (jamais un délai inventé). */
export function paymentTermsSentence(einvoicing: EinvoicingSettings, dueDate: Date | null): string {
  if (present(einvoicing.paymentTermsText)) return einvoicing.paymentTermsText;
  return dueDate ? `Paiement au plus tard le ${parisDay.format(dueDate)}.` : "Paiement à réception de la facture.";
}

/** Mentions visibles du PDF de facture : seulement ce qui est connu, dans l'ordre d'usage. */
export function invoiceLegalMentions(input: {
  seller: InvoiceSeller;
  einvoicing: EinvoicingSettings;
  buyer: InvoiceBuyer;
  dueDate: Date | null;
  periodSentence: string;
  hasExempt: boolean;
}): InvoicePdfLegalMentions {
  const { seller, einvoicing, buyer } = input;
  const sellerName = present(seller.legalName) ? seller.legalName : seller.name;
  const legalInfo = [
    [einvoicing.legalForm, present(einvoicing.shareCapital) ? `au capital de ${einvoicing.shareCapital}` : undefined].filter(present).join(" "),
    einvoicing.rcs,
  ]
    .filter(present)
    .join(" — ");
  const cityLine = (postalCode: string | null, city: string | null) => [postalCode, city].filter(present).join(" ");
  const sellerLines = [
    seller.billingAddress,
    cityLine(seller.billingPostalCode, seller.billingCity),
    present(seller.siren) ? `SIREN ${seller.siren}` : null,
    present(seller.siret) ? `SIRET ${seller.siret}` : null,
    present(einvoicing.vatNumber) ? `TVA ${einvoicing.vatNumber}` : null,
  ].filter(present);
  const buyerLines = [
    buyer.address,
    cityLine(buyer.postalCode, buyer.city),
    present(buyer.siren) ? `SIREN ${buyer.siren}` : null,
    present(buyer.vatNumber) ? `TVA ${buyer.vatNumber}` : null,
  ].filter(present);
  const mentions = [
    `Livraisons ${input.periodSentence}.`,
    legalInfo || null,
    input.hasExempt ? einvoicing.vatExemptionReason ?? null : null,
    paymentTermsSentence(einvoicing, input.dueDate),
    einvoicing.latePenaltyText ?? null,
    RECOVERY_INDEMNITY_NOTE,
    einvoicing.earlyPaymentDiscountText ?? null,
  ].filter(present);
  const footer = [sellerName, legalInfo, present(seller.siren) ? `SIREN ${seller.siren}` : null, present(einvoicing.vatNumber) ? `TVA ${einvoicing.vatNumber}` : null]
    .filter(present)
    .join(" · ");
  return {
    documentLabel: "Facture",
    seller: { name: sellerName, lines: sellerLines },
    buyer: { name: buyer.name, lines: buyerLines },
    mentions,
    footer,
  };
}
