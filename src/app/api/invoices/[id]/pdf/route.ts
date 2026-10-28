import { NextResponse } from "next/server";
import { buildFacturXPdf, facturXHttpResult } from "@/domains/invoice/facturx/facturx-document";
import { loadFacturXInvoice, renderClassicInvoicePdf } from "@/domains/invoice/facturx/facturx.service";
import { getCompanyId, requireRole, requireStaffRole } from "@/lib/api/auth-guard";

export const runtime = "nodejs";

/**
 * Back-office : relevé PDF d'une facture de l'entreprise de la session.
 * `?format=facturx` produit le PDF Factur-X (XML CII embarqué) ; sans paramètre, le PDF classique.
 */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireStaffRole("invoices:read");
  if ("error" in auth) return auth.error;
  const denied = requireRole(auth.context, ["COMPANY_ADMIN", "MINI_ADMIN"]);
  if (denied) return denied;
  const companyId = getCompanyId(auth.context);
  if (!companyId) return NextResponse.json({ error: "Entreprise non associée" }, { status: 403 });

  const format = new URL(request.url).searchParams.get("format") ?? "classic";
  if (format !== "classic" && format !== "facturx") {
    return NextResponse.json({ error: "Format inconnu (classic ou facturx)" }, { status: 400 });
  }

  const { id } = await params;
  const invoice = await loadFacturXInvoice({ invoiceId: id, companyId });
  if (!invoice) return NextResponse.json({ error: "Facture introuvable" }, { status: 404 });

  if (format === "classic") {
    const pdf = await renderClassicInvoicePdf(invoice);
    return new NextResponse(Buffer.from(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${invoice.reference}.pdf"`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  }

  if (!invoice.source) {
    return new NextResponse("Factur-X indisponible : la facture n'est rattachée à aucun client.", {
      status: 422,
      headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "private, no-store" },
    });
  }
  const result = await buildFacturXPdf({ source: invoice.source, renderClassicPdf: (legal) => renderClassicInvoicePdf(invoice, legal), now: new Date() });
  const http = facturXHttpResult(result, invoice.reference, "staff");
  return new NextResponse(typeof http.body === "string" ? http.body : Buffer.from(http.body), { status: http.status, headers: http.headers });
}
