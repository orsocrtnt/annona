import { NextResponse } from "next/server";
import { getCompanyId, requireStaffRole } from "@/lib/api/auth-guard";
import { createOrderInvoice } from "@/domains/invoice/invoice.service";
import { createOrderInvoiceSchema } from "@/lib/validations/invoice";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireStaffRole("orders:update");
  if ("error" in auth) return auth.error;

  const companyId = getCompanyId(auth.context);
  if (!companyId) {
    return NextResponse.json({ error: "Entreprise non associée" }, { status: 400 });
  }

  const body = await request.json();
  const parsed = createOrderInvoiceSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Données invalides", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { id } = await params;

  try {
    const invoice = await createOrderInvoice(companyId, id, parsed.data);
    if (!invoice) {
      return NextResponse.json({ error: "Commande introuvable" }, { status: 404 });
    }
    return NextResponse.json({ data: invoice, success: true });
  } catch (error) {
    if (error instanceof Error) {
      const messages: Record<string, string> = {
        INVOICE_ALREADY_PAID: "Cette commande a déjà une facture payée",
        INVOICE_EMPTY: "Sélectionnez au moins une zone, un supplément ou une ligne",
        ZONE_NOT_FOUND: "La zone tarifaire sélectionnée n'existe plus — rechargez la page",
        PURCHASES_EMPTY:
          "Aucun achat facturable : les articles n'ont pas de prix (le livreur doit valider les achats)",
      };
      if (messages[error.message]) {
        return NextResponse.json({ error: messages[error.message] }, { status: 400 });
      }
      console.error("[invoice] createOrderInvoice failed:", error);
      return NextResponse.json(
        { error: "Impossible d'émettre la facture. Réessayez ou contactez le support." },
        { status: 500 }
      );
    }
    throw error;
  }
}
