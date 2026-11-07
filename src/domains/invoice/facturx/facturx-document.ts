/**
 * Assemblage du PDF Factur-X (sans accès base) et réponse HTTP associée.
 * Le PDF classique reste la source visuelle ; le Factur-X y ajoute le XML et les métadonnées.
 */
import { einvoicingFieldPath, RULE_FIELD } from "@/domains/invoice/facturx/facturx-readiness";
import { computeFacturXTotals, FACTURX_CONFORMANCE_LEVEL, serializeFacturXXml } from "@/domains/invoice/facturx/cii-generator";
import { mapInvoiceToFacturX, type FacturXSource } from "@/domains/invoice/facturx/facturx-mapping";
import type { FacturXInvoice, FacturXIssue } from "@/domains/invoice/facturx/facturx.types";
import { embedFacturXInPdf } from "@/lib/pdf/facturx-pdf";
import type { InvoicePdfLegalMentions } from "@/lib/pdf/invoice-pdf";

export type FacturXDocumentResult =
  | { ok: true; pdf: Uint8Array; xml: string; warnings: FacturXIssue[] }
  | { ok: false; errors: FacturXIssue[]; warnings: FacturXIssue[] };

const euros = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" });
const parisDay = new Intl.DateTimeFormat("fr-FR", { timeZone: "Europe/Paris", day: "2-digit", month: "2-digit", year: "numeric" });

/** Mentions visibles du Factur-X, construites depuis le même modèle que le XML (document hybride cohérent). */
export function facturXVisibleMentions(invoice: FacturXInvoice): InvoicePdfLegalMentions {
  const partyLines = (party: FacturXInvoice["seller"]) =>
    [
      party.address.line1,
      party.address.line2,
      `${party.address.postalCode} ${party.address.city}${party.address.countryCode !== "FR" ? ` (${party.address.countryCode})` : ""}`,
      party.siren && `SIREN ${party.siren}`,
      party.siret && `SIRET ${party.siret}`,
      party.vatNumber ? `TVA ${party.vatNumber}` : party.taxRegistrationId && `Identifiant fiscal ${party.taxRegistrationId}`,
    ].filter((line): line is string => Boolean(line && line.trim()));

  const exemptions = Object.values(invoice.vatExemptions).map((exemption) => exemption?.reason);
  const notes = invoice.notes.filter((note) => note.subjectCode !== "AAI").map((note) => note.content);
  const delivered = invoice.deliveryDate ? `Date de livraison : ${parisDay.format(invoice.deliveryDate)}.` : undefined;
  const prepaid = invoice.prepaidAmount
    ? `Montant déjà réglé : ${euros.format(invoice.prepaidAmount)} — solde dû : ${euros.format(computeFacturXTotals(invoice).duePayableCents / 100)}.`
    : undefined;
  return {
    documentLabel: invoice.typeCode === "381" ? "Avoir" : "Facture",
    seller: { name: invoice.seller.name, lines: partyLines(invoice.seller) },
    buyer: { name: invoice.buyer.name, lines: partyLines({ ...invoice.buyer, siret: undefined, taxRegistrationId: undefined }) },
    mentions: [invoice.seller.legalInfo, ...exemptions, invoice.paymentTerms, ...notes, delivered, prepaid].filter(
      (line): line is string => Boolean(line && line.trim())
    ),
    footer: "Facture accompagnée de ses données structurées Factur-X (profil EN 16931), fichier factur-x.xml joint.",
  };
}

export async function buildFacturXPdf(input: {
  source: FacturXSource;
  /** Rendu du relevé ; reçoit les mentions légales visibles propres à la variante Factur-X. */
  renderClassicPdf: (legal: InvoicePdfLegalMentions) => Promise<Uint8Array>;
  now: Date;
}): Promise<FacturXDocumentResult> {
  const mapped = mapInvoiceToFacturX(input.source);
  if (!mapped.ok) return mapped;
  // Déjà contrôlée et totalisée par le mapping : sérialisation sans recalcul.
  const xml = serializeFacturXXml(mapped.invoice, mapped.totals);
  const pdf = await embedFacturXInPdf(await input.renderClassicPdf(facturXVisibleMentions(mapped.invoice)), {
    xml,
    documentDate: input.now,
    conformanceLevel: FACTURX_CONFORMANCE_LEVEL,
  });
  return { ok: true, pdf, xml, warnings: mapped.warnings };
}

export interface FacturXHttpResult {
  status: number;
  headers: Record<string, string>;
  body: Uint8Array | string;
}

export const safeFilename = (reference: string) => reference.replace(/[^A-Za-z0-9._-]+/g, "_") || "facture";

/**
 * 200 : PDF Factur-X en pièce jointe.
 * 422 : refus lisible en texte brut (le lien s'ouvre dans un nouvel onglet) ; le PDF classique reste disponible.
 */
export function facturXHttpResult(result: FacturXDocumentResult, reference: string, audience: "staff" | "client", settingsLinks = true): FacturXHttpResult {
  const common = { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" };
  if (result.ok) {
    return {
      status: 200,
      headers: {
        ...common,
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${safeFilename(reference)}-facturx.pdf"`,
      },
      body: result.pdf,
    };
  }
  const statusIssue = result.errors.find((issue) => issue.rule === "TL-STATUT");
  const lines =
    audience === "staff"
      ? result.errors.map((issue) => {
          const field = RULE_FIELD[issue.rule];
          return `- ${issue.message} [${issue.rule}]${field && settingsLinks ? `\n  Action : ${einvoicingFieldPath(field)}` : ""}${field && !settingsLinks ? "\n  Action : demandez à l'administrateur principal de compléter ce champ (Réglages › Facturation)." : ""}`;
        })
      : [statusIssue ? statusIssue.message : "Votre prestataire doit compléter ses informations de facturation avant de pouvoir émettre ce format. Contactez-le pour qu'il le fasse ; en attendant, le PDF classique est disponible."];
  return {
    status: 422,
    headers: { ...common, "Content-Type": "text/plain; charset=utf-8" },
    body: [
      `Factur-X indisponible pour la facture ${reference}.`,
      "",
      ...lines,
      "",
      "Le PDF classique de la facture reste téléchargeable.",
    ].join("\n"),
  };
}
