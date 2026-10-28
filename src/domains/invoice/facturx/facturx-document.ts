/**
 * Assemblage du PDF Factur-X (sans accès base) et réponse HTTP associée.
 * Le PDF classique reste la source visuelle ; le Factur-X y ajoute le XML et les métadonnées.
 */
import { FACTURX_CONFORMANCE_LEVEL, generateFacturXXml } from "@/domains/invoice/facturx/cii-generator";
import { mapInvoiceToFacturX, type FacturXSource } from "@/domains/invoice/facturx/facturx-mapping";
import type { FacturXIssue } from "@/domains/invoice/facturx/facturx.types";
import { embedFacturXInPdf } from "@/lib/pdf/facturx-pdf";

export type FacturXDocumentResult =
  | { ok: true; pdf: Uint8Array; xml: string; warnings: FacturXIssue[] }
  | { ok: false; errors: FacturXIssue[]; warnings: FacturXIssue[] };

export async function buildFacturXPdf(input: {
  source: FacturXSource;
  renderClassicPdf: () => Promise<Uint8Array>;
  now: Date;
}): Promise<FacturXDocumentResult> {
  const mapped = mapInvoiceToFacturX(input.source);
  if (!mapped.ok) return mapped;
  const xml = generateFacturXXml(mapped.invoice);
  const pdf = await embedFacturXInPdf(await input.renderClassicPdf(), {
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

const safeFilename = (reference: string) => reference.replace(/[^A-Za-z0-9._-]+/g, "_") || "facture";

/**
 * 200 : PDF Factur-X en pièce jointe.
 * 422 : refus lisible en texte brut (le lien s'ouvre dans un nouvel onglet) ; le PDF classique reste disponible.
 */
export function facturXHttpResult(result: FacturXDocumentResult, reference: string, audience: "staff" | "client"): FacturXHttpResult {
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
      ? result.errors.map((issue) => `- ${issue.message} [${issue.rule}]`)
      : [statusIssue ? statusIssue.message : "Votre prestataire doit compléter ses informations de facturation avant de pouvoir émettre ce format."];
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
