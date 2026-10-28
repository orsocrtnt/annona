import { NextResponse } from "next/server";
import { getCompanyId, requireRole, requireStaffRole } from "@/lib/api/auth-guard";
import { remindInvoice } from "@/domains/invoice/invoice-reminder.service";
import { getEmailDeliveryConfigured } from "@/domains/client-portal/notify.service";

/**
 * DEMO-3 : « Relancer » une facture en attente ou en retard. Toujours tracée ;
 * l'e-mail ne part que si l'envoi est configuré. Un second clic sous 24 h
 * rejoue la relance existante (duplicate: true) sans nouvel envoi.
 */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireStaffRole("invoices:update");
  if ("error" in auth) return auth.error;
  const denied = requireRole(auth.context, ["COMPANY_ADMIN", "MINI_ADMIN"]);
  if (denied) return denied;
  const companyId = getCompanyId(auth.context);
  if (!companyId) return NextResponse.json({ error: "Entreprise non associée" }, { status: 403 });

  const { id } = await params;
  try {
    const result = await remindInvoice({
      companyId,
      invoiceId: id,
      userId: auth.context.user.id,
      emailConfigured: getEmailDeliveryConfigured(),
    });
    if (!result) return NextResponse.json({ error: "Facture introuvable" }, { status: 404 });
    return NextResponse.json({ data: result, success: true });
  } catch (error) {
    if (error instanceof Error && error.message === "INVOICE_NOT_REMINDABLE") {
      return NextResponse.json(
        { error: "Cette facture est réglée, annulée ou en brouillon : aucune relance possible." },
        { status: 409 }
      );
    }
    console.error("[invoice-reminder] échec", error instanceof Error ? error.message : "Erreur inconnue");
    return NextResponse.json({ error: "Relance impossible. Réessayez." }, { status: 500 });
  }
}
