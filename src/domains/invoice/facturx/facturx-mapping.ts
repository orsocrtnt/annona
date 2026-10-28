/**
 * Passage d'une facture TutelLiv (Invoice + Company + client) au modèle Factur-X.
 * Fonction pure : les données sont chargées par facturx.service.ts.
 * Chaque refus porte un message actionnable qui dit où compléter la donnée.
 */
import { checkFacturXInvoice, computeFacturXTotals } from "@/domains/invoice/facturx/cii-generator";
import type { FacturXInvoice, FacturXIssue, FacturXLine, FacturXNote } from "@/domains/invoice/facturx/facturx.types";
import type { ClientInvoiceIdentity, EinvoicingSettings } from "@/lib/validations/einvoicing";

export const RECOVERY_INDEMNITY_NOTE = "Indemnité forfaitaire pour frais de recouvrement en cas de retard de paiement : 40 €.";

export interface FacturXSourceInvoice {
  reference: string;
  status: string;
  createdAt: Date;
  dueDate: Date | null;
  amount: number;
  lineItems: unknown;
  notes: string | null;
  orderReference: string | null;
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
  buyer: FacturXSourceBuyer;
}

export type FacturXMappingResult =
  | { ok: true; invoice: FacturXInvoice; warnings: FacturXIssue[] }
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

interface RawLine {
  label: string;
  amount: number;
  quantity: number;
  sourceType?: string;
}

function parseLines(raw: unknown): RawLine[] | null {
  if (!Array.isArray(raw)) return null;
  const lines: RawLine[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") return null;
    const { label, amount, quantity, sourceType } = item as Record<string, unknown>;
    const qty = quantity === undefined ? 1 : quantity;
    if (typeof label !== "string" || typeof amount !== "number" || !Number.isFinite(amount) || typeof qty !== "number" || !Number.isInteger(qty) || qty < 1) {
      return null;
    }
    lines.push({ label, amount, quantity: qty, sourceType: typeof sourceType === "string" ? sourceType : undefined });
  }
  return lines;
}

const cents = (euros: number) => Math.round(Number((euros * 100).toFixed(6)));
const present = (value: string | null | undefined): value is string => Boolean(value && value.trim());

function parseVatRate(label: string): number | null {
  const match = label.match(/(\d+(?:[.,]\d+)?)\s*%/);
  if (!match) return null;
  const rate = Number(match[1]!.replace(",", "."));
  return rate > 0 && rate < 100 ? rate : null;
}

const PARIS_DAY = new Intl.DateTimeFormat("fr-FR", { timeZone: "Europe/Paris", day: "2-digit", month: "2-digit", year: "numeric" });

export function mapInvoiceToFacturX(source: FacturXSource): FacturXMappingResult {
  const errors: FacturXIssue[] = [];
  const warnings: FacturXIssue[] = [];
  const { invoice, seller, einvoicing, buyer } = source;

  if (invoice.status === "DRAFT") errors.push({ rule: "TL-STATUT", message: "Facture en brouillon : le Factur-X est disponible une fois la facture émise." });
  if (invoice.status === "CANCELLED") errors.push({ rule: "TL-STATUT", message: "Facture annulée : aucun Factur-X n'est émis." });

  // Lignes et TVA.
  const rawLines = parseLines(invoice.lineItems);
  let lines: FacturXLine[] = [];
  let category: "S" | "E" = "S";
  let rate = 0;
  if (!rawLines) {
    errors.push({ rule: "TL-LIGNES", message: "Lignes de facture illisibles : régénérez la facture avant d'exporter le Factur-X." });
  } else {
    const vatLines = rawLines.filter((line) => line.sourceType === "VAT");
    const itemLines = rawLines.filter((line) => line.sourceType !== "VAT");
    if (vatLines.length > 1) {
      errors.push({ rule: "TL-TVA", message: "Plusieurs lignes de TVA : ce cas n'est pas encore géré par l'export Factur-X." });
    } else if (vatLines.length === 1) {
      const parsedRate = parseVatRate(vatLines[0]!.label);
      if (parsedRate === null) {
        errors.push({ rule: "TL-TVA", message: `Taux de TVA illisible dans « ${vatLines[0]!.label} ».` });
      } else {
        rate = parsedRate;
      }
    } else {
      category = "E";
    }
    lines = itemLines.map((line, index) => ({
      id: String(index + 1),
      name: line.label,
      quantity: line.quantity,
      unitPrice: line.amount,
      vatCategory: category,
      vatRate: category === "S" ? rate : 0,
    }));

    const storedTotal = rawLines.reduce((sum, line) => sum + cents(line.amount * line.quantity), 0);
    if (storedTotal !== cents(invoice.amount)) {
      errors.push({ rule: "TL-TOTAL", message: "Le total de la facture ne correspond pas à la somme de ses lignes : export Factur-X refusé." });
    }
    if (vatLines.length === 1 && rate > 0 && errors.length === 0) {
      const recomputed = computeFacturXTotals({ lines, vatExemptions: {} } as unknown as FacturXInvoice).taxTotalCents;
      const stored = cents(vatLines[0]!.amount * vatLines[0]!.quantity);
      if (recomputed !== stored) {
        errors.push({ rule: "TL-TVA", message: `TVA enregistrée (${(stored / 100).toFixed(2)} €) différente de ${rate} % du total HT (${(recomputed / 100).toFixed(2)} €).` });
      }
    }
  }

  // Mentions françaises obligatoires entre professionnels (art. L441-9 du Code de commerce).
  if (!present(seller.siren)) errors.push({ rule: "TL-FR-SIREN", message: `SIREN de l'entreprise manquant. ${SELLER_HINT}` });
  if (!present(einvoicing.latePenaltyText)) errors.push({ rule: "TL-FR-PENALITES", message: `Mention des pénalités de retard manquante. ${SELLER_HINT}` });
  if (!present(einvoicing.earlyPaymentDiscountText)) errors.push({ rule: "TL-FR-ESCOMPTE", message: `Conditions d'escompte manquantes (ex. « Pas d'escompte pour paiement anticipé. »). ${SELLER_HINT}` });

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
    category === "E" && !einvoicing.vatNumber ? einvoicing.taxRegistrationId ?? (present(seller.siren) ? seller.siren : undefined) : undefined;
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
    lines,
    vatExemptions:
      category === "E" && present(exemptionReason)
        ? { E: { reason: exemptionReason, code: /293\s*B/i.test(exemptionReason) ? "VATEX-FR-FRANCHISE" : undefined } }
        : {},
    payment: einvoicing.iban ? { typeCode: "58", iban: einvoicing.iban, bic: einvoicing.bic } : undefined,
    paymentReference: invoice.reference,
    // Facture réglée : le Factur-X porte le montant payé et un solde nul (BT-113, BT-115).
    prepaidAmount: invoice.status === "PAID" ? invoice.amount : undefined,
  };

  for (const issue of checkFacturXInvoice(facturx)) {
    if (issue.rule === "BR-16" && errors.some((e) => e.rule === "TL-LIGNES")) continue;
    errors.push(HINTS[issue.rule] ? { ...issue, message: `${issue.message} ${HINTS[issue.rule]}` } : issue);
  }

  if (!present(identity?.siren)) {
    warnings.push({ rule: "TL-W-SIREN-CLIENT", message: "SIREN du client absent : les plateformes agréées l'exigent pour une facture entre entreprises françaises." });
  }
  if (!einvoicing.iban) warnings.push({ rule: "TL-W-IBAN", message: "Aucun IBAN : la facture ne porte pas de coordonnées de virement." });

  return errors.length ? { ok: false, errors, warnings } : { ok: true, invoice: facturx, warnings };
}
