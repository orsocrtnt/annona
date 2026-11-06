/**
 * Passage d'une facture Annona (Invoice + Company + client) au modèle Factur-X.
 * Fonction pure : les données sont chargées par facturx.service.ts.
 * Chaque refus porte un message actionnable qui dit où compléter la donnée.
 */
import { checkFacturXInvoice, computeFacturXTotals } from "@/domains/invoice/facturx/cii-generator";
import { checkSellerReadiness, EXPORT_CHECKED_BY_MAPPING } from "@/domains/invoice/facturx/facturx-readiness";
import { facturXUnavailableReason } from "@/domains/invoice/facturx/facturx-availability";
import type { FacturXInvoice, FacturXIssue, FacturXLine, FacturXNote, FacturXTotals } from "@/domains/invoice/facturx/facturx.types";
import type { ClientInvoiceIdentity, EinvoicingSettings } from "@/lib/validations/einvoicing";

export const RECOVERY_INDEMNITY_NOTE = "Indemnité forfaitaire pour frais de recouvrement en cas de retard de paiement : 40 €.";

/** Ligne de facture de période (table `invoice_lines`) : montants en centimes, TVA en points de base. */
export interface FacturXSourceLine {
  label: string;
  quantity: number;
  unitPriceCents: number;
  /** 550 = 5,5 % ; 0 = ligne exonérée. */
  vatRateBasisPoints: number;
}

export interface FacturXSourceInvoice {
  reference: string;
  status: string;
  /** Date d'émission (BT-2). */
  createdAt: Date;
  dueDate: Date | null;
  /** Lignes stockées, relues de façon tolérante (`unknown`) : toute ligne illisible bloque l'export. */
  lines: unknown;
  subtotalCents: number;
  vatCents: number;
  totalCents: number;
  notes: string | null;
  orderReference: string | null;
  /** Dernier jour livré de la période (BT-72), si connu. */
  deliveryDate?: Date | null;
}

export interface FacturXSourceSeller {
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

export interface FacturXSourceBuyer {
  firstName: string;
  lastName: string;
  email: string | null;
  identity: ClientInvoiceIdentity | null;
  defaultAddress: { address: string; postalCode: string | null; city: string | null } | null;
}

export interface FacturXSource {
  invoice: FacturXSourceInvoice;
  seller: FacturXSourceSeller;
  einvoicing: EinvoicingSettings;
  /** Champs stockés écartés car invalides (lecture tolérante). */
  einvoicingInvalidFields?: string[];
  buyer: FacturXSourceBuyer;
}

export type FacturXMappingResult =
  | { ok: true; invoice: FacturXInvoice; totals: FacturXTotals; warnings: FacturXIssue[] }
  | { ok: false; errors: FacturXIssue[]; warnings: FacturXIssue[] };

const SELLER_HINT = "À compléter dans Réglages › Facturation › Mentions légales et Factur-X.";
const BUYER_HINT = "À compléter dans la fiche du client (Clients › Identité de facturation).";
const HINTS: Record<string, string> = {
  "BR-06": SELLER_HINT,
  "BR-08": SELLER_HINT,
  "BR-09": SELLER_HINT,
  "BR-CO-26": SELLER_HINT,
  "BR-S-02": SELLER_HINT,
  "BR-E-02": SELLER_HINT,
  "BR-E-10": SELLER_HINT,
  "BR-61": SELLER_HINT,
  "BR-07": BUYER_HINT,
  "BR-10": BUYER_HINT,
  "BR-11": BUYER_HINT,
  "BR-AE-02": BUYER_HINT,
};

function parseLines(raw: unknown): FacturXSourceLine[] | null {
  if (!Array.isArray(raw)) return null;
  const lines: FacturXSourceLine[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") return null;
    const { label, quantity, unitPriceCents, vatRateBasisPoints } = item as Record<string, unknown>;
    if (
      typeof label !== "string" ||
      typeof quantity !== "number" || !Number.isInteger(quantity) || quantity < 1 ||
      typeof unitPriceCents !== "number" || !Number.isInteger(unitPriceCents) || unitPriceCents < 0 ||
      typeof vatRateBasisPoints !== "number" || !Number.isInteger(vatRateBasisPoints) || vatRateBasisPoints < 0 || vatRateBasisPoints >= 10_000
    ) {
      return null;
    }
    lines.push({ label, quantity, unitPriceCents, vatRateBasisPoints });
  }
  return lines;
}

const present = (value: string | null | undefined): value is string => Boolean(value && value.trim());

const PARIS_DAY = new Intl.DateTimeFormat("fr-FR", { timeZone: "Europe/Paris", day: "2-digit", month: "2-digit", year: "numeric" });

export function mapInvoiceToFacturX(source: FacturXSource): FacturXMappingResult {
  const errors: FacturXIssue[] = [];
  const warnings: FacturXIssue[] = [];
  const { invoice, seller, einvoicing, buyer } = source;

  const unavailable = facturXUnavailableReason(invoice.status);
  if (unavailable) errors.push({ rule: "TL-STATUT", message: unavailable });

  // Lignes et TVA : un taux par ligne (pain à 5,5 %, autres produits à 10 % ou 20 %), exonération à 0.
  const rawLines = parseLines(invoice.lines);
  let lines: FacturXLine[] = [];
  if (!rawLines || rawLines.length === 0) {
    errors.push({ rule: "TL-LIGNES", message: "Lignes de facture illisibles : régénérez la facture avant d'exporter le Factur-X." });
  } else {
    lines = rawLines.map((line, index) => ({
      id: String(index + 1),
      name: line.label,
      quantity: line.quantity,
      unitPrice: line.unitPriceCents / 100,
      vatCategory: line.vatRateBasisPoints > 0 ? "S" : "E",
      vatRate: line.vatRateBasisPoints / 100,
    }));
    const linesTotal = rawLines.reduce((sum, line) => sum + line.quantity * line.unitPriceCents, 0);
    if (linesTotal !== invoice.subtotalCents || invoice.subtotalCents + invoice.vatCents !== invoice.totalCents) {
      errors.push({ rule: "TL-TOTAL", message: "Le total de la facture ne correspond pas à la somme de ses lignes : export Factur-X refusé." });
    }
  }
  const hasExempt = lines.some((line) => line.vatCategory === "E");
  const allExempt = lines.length > 0 && lines.every((line) => line.vatCategory === "E");

  // Mentions françaises obligatoires entre professionnels (art. L441-9 du Code de commerce).
  // Règle partagée avec l'enregistrement des mentions légales (facturx-readiness.ts) : une seule source.
  for (const issue of checkSellerReadiness({
    identity: { siren: seller.siren, billingAddress: seller.billingAddress, billingPostalCode: seller.billingPostalCode, billingCity: seller.billingCity, country: seller.country ?? "FR" },
    einvoicing,
  })) {
    if (EXPORT_CHECKED_BY_MAPPING.has(issue.rule)) errors.push({ rule: issue.rule, message: `${issue.message} ${SELLER_HINT}` });
  }

  const legalInfo = [
    [einvoicing.legalForm, einvoicing.shareCapital ? `au capital de ${einvoicing.shareCapital}` : undefined].filter(Boolean).join(" "),
    einvoicing.rcs,
  ]
    .filter(present)
    .join(" — ");

  const identity = buyer.identity;
  const buyerAddress = identity
    ? { line1: identity.address, postalCode: identity.postalCode, city: identity.city, countryCode: identity.countryCode }
    : buyer.defaultAddress
      ? { line1: buyer.defaultAddress.address, postalCode: buyer.defaultAddress.postalCode ?? "", city: buyer.defaultAddress.city ?? "", countryCode: "FR" }
      : { line1: "", postalCode: "", city: "", countryCode: "FR" };

  const candidates: Array<FacturXNote | false> = [
    present(einvoicing.latePenaltyText) && { subjectCode: "PMD", content: einvoicing.latePenaltyText },
    { subjectCode: "PMT", content: RECOVERY_INDEMNITY_NOTE },
    present(einvoicing.earlyPaymentDiscountText) && { subjectCode: "AAB", content: einvoicing.earlyPaymentDiscountText },
    present(invoice.notes) && { subjectCode: "AAI", content: invoice.notes },
  ];
  const notes = candidates.filter((note): note is FacturXNote => Boolean(note));

  const exemptionReason = einvoicing.vatExemptionReason;
  const franchiseTaxId =
    allExempt && !einvoicing.vatNumber ? einvoicing.taxRegistrationId ?? (present(seller.siren) ? seller.siren : undefined) : undefined;
  if (franchiseTaxId && !einvoicing.taxRegistrationId) {
    warnings.push({ rule: "TL-W-BT32-SIREN", message: "Sans n° de TVA, l'identifiant fiscal (BT-32) reprend le SIREN : à confirmer avec votre plateforme ou votre expert-comptable." });
  }

  const facturx: FacturXInvoice = {
    number: invoice.reference,
    typeCode: "380",
    issueDate: invoice.createdAt,
    dueDate: invoice.dueDate,
    currency: "EUR",
    paymentTerms:
      einvoicing.paymentTermsText ??
      (invoice.dueDate ? `Paiement au plus tard le ${PARIS_DAY.format(invoice.dueDate)}.` : "Paiement à réception de la facture."),
    notes,
    seller: {
      name: present(seller.legalName) ? seller.legalName : seller.name,
      siren: seller.siren ?? undefined,
      siret: seller.siret ?? undefined,
      vatNumber: einvoicing.vatNumber,
      // Franchise en base sans n° de TVA : BT-32 satisfait BR-E-02 (identifiant saisi, sinon SIREN — à confirmer FNFE).
      taxRegistrationId: franchiseTaxId,
      email: seller.email ?? undefined,
      legalInfo: legalInfo || undefined,
      address: {
        line1: seller.billingAddress ?? "",
        postalCode: seller.billingPostalCode ?? "",
        city: seller.billingCity ?? "",
        countryCode: (seller.country ?? "FR").toUpperCase(),
      },
    },
    buyer: {
      name: present(identity?.companyName) ? identity!.companyName! : `${buyer.firstName} ${buyer.lastName}`.trim(),
      siren: identity?.siren,
      vatNumber: identity?.vatNumber,
      email: buyer.email ?? undefined,
      address: buyerAddress,
    },
    sellerOrderReference: invoice.orderReference ?? undefined,
    deliveryDate: invoice.deliveryDate ?? undefined,
    lines,
    vatExemptions:
      hasExempt && present(exemptionReason)
        ? { E: { reason: exemptionReason, code: /293\s*B/i.test(exemptionReason) ? "VATEX-FR-FRANCHISE" : undefined } }
        : {},
    payment: einvoicing.iban ? { typeCode: "58", iban: einvoicing.iban, bic: einvoicing.bic } : undefined,
    paymentReference: invoice.reference,
    // Facture réglée : le Factur-X porte le montant payé et un solde nul (BT-113, BT-115).
    prepaidAmount: invoice.status === "PAID" ? invoice.totalCents / 100 : undefined,
  };

  const totals = computeFacturXTotals(facturx);
  if (lines.length > 0 && !errors.some((e) => e.rule === "TL-TOTAL") && totals.taxTotalCents !== invoice.vatCents) {
    // Placée en tête : c'est la cause première, avant toute règle dérivée.
    errors.unshift({
      rule: "TL-TVA",
      message: `TVA enregistrée (${(invoice.vatCents / 100).toFixed(2)} €) différente de la TVA recalculée par taux (${(totals.taxTotalCents / 100).toFixed(2)} €).`,
    });
  }

  for (const issue of checkFacturXInvoice(facturx, totals)) {
    if (issue.rule === "BR-16" && errors.some((e) => e.rule === "TL-LIGNES")) continue;
    errors.push(HINTS[issue.rule] ? { ...issue, message: `${issue.message} ${HINTS[issue.rule]}` } : issue);
  }

  if (!present(identity?.siren)) {
    warnings.push({ rule: "TL-W-SIREN-CLIENT", message: "SIREN du client absent : les plateformes agréées l'exigent pour une facture entre entreprises françaises." });
  }
  if (einvoicing.iban && !einvoicing.bic) warnings.push({ rule: "TL-W-BIC", message: `BIC absent : recommandé avec l'IBAN pour un virement (non bloquant). ${SELLER_HINT}` });
  if (!einvoicing.iban) warnings.push({ rule: "TL-W-IBAN", message: "Aucun IBAN : la facture ne porte pas de coordonnées de virement." });
  if (source.einvoicingInvalidFields?.length) {
    warnings.push({ rule: "TL-W-REGLAGE-INVALIDE", message: `Réglages ignorés car invalides : ${source.einvoicingInvalidFields.join(", ")}. ${SELLER_HINT}` });
  }

  return errors.length ? { ok: false, errors, warnings } : { ok: true, invoice: facturx, totals, warnings };
}
