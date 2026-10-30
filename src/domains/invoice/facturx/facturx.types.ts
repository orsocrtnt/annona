/**
 * Modèle sémantique minimal d'une facture Factur-X, profil EN 16931 (« Comfort »).
 * Les identifiants BT-/BG- renvoient à la norme EN 16931-1. Le générateur ne lit
 * jamais la base : il reçoit ce modèle déjà construit (voir facturx-mapping.ts).
 */

/** Codes UNTDID 5305 gérés : S = taux normal/réduit, E = exonéré, AE = autoliquidation. */
export type FacturXVatCategory = "S" | "E" | "AE";

export interface FacturXAddress {
  /** BT-35 / BT-50 */
  line1: string;
  /** BT-36 / BT-51 */
  line2?: string;
  /** BT-38 / BT-53 */
  postalCode: string;
  /** BT-37 / BT-52 */
  city: string;
  /** BT-40 / BT-55 : ISO 3166-1 alpha-2 */
  countryCode: string;
}

export interface FacturXParty {
  /** BT-27 / BT-44 : raison sociale */
  name: string;
  /** BT-30 / BT-47 : SIREN (schéma 0002) */
  siren?: string;
  /** SIRET : conservé pour information, non émis dans ce profil (BT-29 hors périmètre) */
  siret?: string;
  /** BT-31 / BT-48 : n° de TVA intracommunautaire */
  vatNumber?: string;
  /** BT-32 : identifiant fiscal du vendeur (schéma FC), utile sans n° de TVA (franchise en base) */
  taxRegistrationId?: string;
  /** BT-34 / BT-49 : adresse électronique (schéma EM) */
  email?: string;
  /** BT-33 : informations juridiques complémentaires (forme, capital, RCS) — vendeur uniquement */
  legalInfo?: string;
  address: FacturXAddress;
}

export interface FacturXLine {
  /** BT-126 */
  id: string;
  /** BT-153 */
  name: string;
  /** BT-129 (unité C62 = « unité ») */
  quantity: number;
  /** BT-146 : prix unitaire net HT, en euros */
  unitPrice: number;
  /** BT-151 */
  vatCategory: FacturXVatCategory;
  /** BT-152 : taux en pourcentage (0 pour E et AE) */
  vatRate: number;
}

export interface FacturXNote {
  /** BT-21 : PMD (pénalités), PMT (indemnité forfaitaire), AAB (escompte)… */
  subjectCode?: string;
  /** BT-22 */
  content: string;
}

export interface FacturXVatExemption {
  /** BT-120 */
  reason: string;
  /** BT-121 (VATEX) */
  code?: string;
}

export interface FacturXPaymentMeans {
  /** BT-81 : 58 = virement SEPA, 30 = virement */
  typeCode: "58" | "30";
  /** BT-84 */
  iban: string;
  /** BT-86 */
  bic?: string;
}

export interface FacturXInvoice {
  /** BT-1 */
  number: string;
  /** BT-3 : 380 = facture, 381 = avoir */
  typeCode: "380" | "381";
  /** BT-2 */
  issueDate: Date;
  /** BT-9 */
  dueDate?: Date | null;
  /** BT-5 */
  currency: "EUR";
  /** BT-20 */
  paymentTerms?: string;
  /** BG-1 */
  notes: FacturXNote[];
  /** BG-4 */
  seller: FacturXParty;
  /** BG-7 */
  buyer: FacturXParty;
  /** BT-14 : référence de la commande côté vendeur */
  sellerOrderReference?: string;
  /** BT-72 : date de livraison effective */
  deliveryDate?: Date;
  /** BG-3 : facture d'origine, pour un avoir */
  precedingInvoice?: { number: string; issueDate: Date };
  /** BG-25 */
  lines: FacturXLine[];
  /** Motifs d'exonération par catégorie (BT-120/BT-121) */
  vatExemptions: Partial<Record<FacturXVatCategory, FacturXVatExemption>>;
  /** BG-16 / BG-17 */
  payment?: FacturXPaymentMeans;
  /** BT-83 */
  paymentReference?: string;
  /** BT-113 : montant déjà réglé (facture payée), en euros */
  prepaidAmount?: number;
}

export interface FacturXIssue {
  /** Règle EN 16931 (BR-…) ou contrôle TutelLiv (TL-…) */
  rule: string;
  message: string;
}

export interface FacturXVatBreakdown {
  category: FacturXVatCategory;
  rate: number;
  basisCents: number;
  taxCents: number;
}

export interface FacturXTotals {
  lineNetCents: number[];
  breakdown: FacturXVatBreakdown[];
  lineTotalCents: number;
  taxBasisTotalCents: number;
  taxTotalCents: number;
  grandTotalCents: number;
  prepaidCents: number;
  duePayableCents: number;
}
