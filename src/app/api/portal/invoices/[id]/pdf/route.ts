import { NextResponse } from "next/server";
import { requireMerchantRole } from "@/lib/api/auth-guard";
import { buildFacturXPdf, facturXHttpResult, safeFilename } from "@/domains/invoice/facturx/facturx-document";
import { loadFacturXInvoice, renderClassicInvoicePdf } from "@/domains/invoice/facturx/facturx.service";

export const runtime = "nodejs";

/**
 * Portail : relevé PDF d'une facture dont l'utilisateur est le client, dans son entreprise.
 * `?format=facturx` : PDF Factur-X ; sinon le relevé classique (même chargement, même filtre).
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireMerchantRole();
  if ("error" in auth) return auth.error;
  const companyId = auth.context.user.companyId;
  if (!companyId) {
    return NextResponse.json({ error: "Entreprise non associée" }, { status: 403 });
  }

  const { id } = await params;
  const loaded = await loadFacturXInvoice({ invoiceId: id, companyId, customerId: auth.context.user.id });
  if (!loaded) return NextResponse.json({ error: "Facture introuvable" }, { status: 404 });

  if (new URL(request.url).searchParams.get("format") === "facturx") {
    if (!loaded.source) return NextResponse.json({ error: "Facture introuvable" }, { status: 404 });
    const result = await buildFacturXPdf({ source: loaded.source, renderClassicPdf: (legal) => renderClassicInvoicePdf(loaded, legal), now: new Date() });
    const http = facturXHttpResult(result, loaded.reference, "client");
    return new NextResponse(typeof http.body === "string" ? http.body : Buffer.from(http.body), { status: http.status, headers: http.headers });
  }

  const pdf = await renderClassicInvoicePdf(loaded);
  return new NextResponse(Buffer.from(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${safeFilename(loaded.reference)}.pdf"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
