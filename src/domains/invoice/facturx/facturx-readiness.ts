/**
 * Règle unique des mentions que l'export Factur-X exige côté vendeur.
 * Fonction pure, sans dépendance serveur : utilisée par l'export (facturx-mapping.ts), par la route
 * d'enregistrement des mentions légales (refus côté serveur) et par le formulaire (messages par champ).
 * Les identifiants `rule` des règles EN 16931 (BR-08, BR-E-10, BR-61) sont ceux du contrôle de cii-generator.ts :
 * tests/facturx-readiness.test.ts vérifie que les deux restent alignés.
 */

export type ReadinessGroup = "identity" | "einvoicing";

export interface ReadinessIssue {
  /** Clé du champ du formulaire (identique à la clé JSON envoyée à l'API). */
  field: string;
  group: ReadinessGroup;
  rule: string;
  message: string;
}

/** Valeurs lues telles quelles (chaînes éventuellement vides ou blanches, null, undefined). */
export interface ReadinessInput {
  identity: {
    siren?: string | null;
    billingAddress?: string | null;
    billingPostalCode?: string | null;
    billingCity?: string | null;
    country?: string | null;
  };
  einvoicing: {
    vatNumber?: string | null;
    taxRegistrationId?: string | null;
    latePenaltyText?: string | null;
    earlyPaymentDiscountText?: string | null;
    vatExemptionReason?: string | null;
    iban?: string | null;
    bic?: string | null;
  };
  /**
   * Taux de TVA des réglages de facturation (en %). Quand il est connu, il décide de la catégorie de TVA des
   * factures : au-dessus de 0, l'export exige le n° de TVA (BR-S-02) ; à 0, le motif d'exonération (BR-E-10).
   * Absent pour l'export, qui lit la catégorie sur les lignes de la facture elle-même.
   */
  vatRate?: number | null;
}

const blank = (value: string | null | undefined) => !value || !value.trim();

/** Mention de TVA proposée (jamais enregistrée d'office : l'utilisateur la valide). */
export const SUGGESTED_VAT_EXEMPTION_REASON = "TVA non applicable, art. 293 B du CGI";

export function checkSellerReadiness({ identity, einvoicing, vatRate }: ReadinessInput): ReadinessIssue[] {
  const issues: ReadinessIssue[] = [];
  const add = (group: ReadinessGroup, field: string, rule: string, message: string) => issues.push({ group, field, rule, message });

  if (blank(identity.siren)) add("identity", "siren", "TL-FR-SIREN", "SIREN de l'entreprise manquant.");
  if (blank(identity.billingAddress)) add("identity", "billingAddress", "BR-08", "Adresse de facturation manquante (rue).");
  if (blank(identity.billingPostalCode)) add("identity", "billingPostalCode", "BR-08", "Code postal manquant.");
  if (blank(identity.billingCity)) add("identity", "billingCity", "BR-08", "Ville manquante.");
  if (blank(identity.country)) add("identity", "country", "BR-09", "Pays manquant (2 lettres, ex. FR).");

  if (blank(einvoicing.latePenaltyText)) {
    add("einvoicing", "latePenaltyText", "TL-FR-PENALITES", "Mention des pénalités de retard manquante.");
  }
  if (blank(einvoicing.earlyPaymentDiscountText)) {
    add("einvoicing", "earlyPaymentDiscountText", "TL-FR-ESCOMPTE", "Conditions d'escompte manquantes (ex. « Pas d'escompte pour paiement anticipé. »).");
  }
  // L'export ne transmet l'identifiant fiscal (BT-32) qu'aux factures exonérées : seul le n° de TVA satisfait BR-S-02.
  if (typeof vatRate === "number" && vatRate > 0 && blank(einvoicing.vatNumber)) {
    add("einvoicing", "vatNumber", "BR-S-02", `N° de TVA intracommunautaire manquant : votre taux de TVA de facturation est de ${vatRate} %, la facture électronique l'exige.`);
  }
  if (vatRate === 0 && blank(einvoicing.vatExemptionReason)) {
    add("einvoicing", "vatExemptionReason", "BR-E-10", `Motif d'exonération de TVA manquant : votre taux de TVA de facturation est de 0 % (ex. « ${SUGGESTED_VAT_EXEMPTION_REASON} »).`);
  }
  return issues;
}

/** Règles reprises telles quelles par l'export : les autres sont contrôlées par cii-generator.ts (BR-*). */
export const EXPORT_CHECKED_BY_MAPPING = new Set(["TL-FR-SIREN", "TL-FR-PENALITES", "TL-FR-ESCOMPTE"]);

/** Règle d'export (cii-generator / mapping) → champ du formulaire « Mentions légales et Factur-X » à compléter. */
export const RULE_FIELD: Record<string, string> = {
  "TL-FR-SIREN": "siren",
  "BR-CO-26": "siren",
  "TL-FR-PENALITES": "latePenaltyText",
  "TL-FR-ESCOMPTE": "earlyPaymentDiscountText",
  "BR-61": "iban",
  "BR-E-10": "vatExemptionReason",
  "BR-08": "billingAddress",
  "BR-09": "country",
  "BR-06": "legalName",
  "BR-S-02": "vatNumber",
  "BR-E-02": "taxRegistrationId",
};

/** Lien direct vers le champ (la page ouvre le bon onglet et place le curseur dans le champ). */
export const einvoicingFieldPath = (field: string) => `/settings/billing#einvoicing-${field}`;

export interface ReadinessAdvisory {
  field: string;
  group: ReadinessGroup;
  message: string;
}

/**
 * Avertissements NON bloquants, pour une entreprise dont la facture électronique n'est pas activée.
 * Le taux de TVA de facturation, quand il est connu, dit quelle mention serait exigée : n° de TVA au-dessus de 0 %,
 * motif d'exonération à 0 %. Sans taux connu, les deux sont signalées. L'identifiant fiscal seul ne lève pas
 * l'avertissement de TVA : l'export ne le transmet qu'aux factures exonérées.
 */
export function checkSellerAdvisories({ einvoicing, vatRate }: Pick<ReadinessInput, "einvoicing" | "vatRate">): ReadinessAdvisory[] {
  const out: ReadinessAdvisory[] = [];
  const withVat = typeof vatRate !== "number" || vatRate > 0;
  const withoutVat = typeof vatRate !== "number" || vatRate === 0;
  if (withoutVat && blank(einvoicing.vatExemptionReason)) {
    out.push({
      group: "einvoicing",
      field: "vatExemptionReason",
      message: `Si vous émettez des factures sans TVA, renseignez le motif d'exonération (ex. « ${SUGGESTED_VAT_EXEMPTION_REASON} » en franchise en base).`,
    });
  }
  if (withVat && blank(einvoicing.vatNumber)) {
    out.push({
      group: "einvoicing",
      field: "vatNumber",
      message: "Pour des factures avec TVA, renseignez votre n° de TVA intracommunautaire.",
    });
  }
  return out;
}
