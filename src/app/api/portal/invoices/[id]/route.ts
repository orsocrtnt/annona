import { NextResponse } from "next/server";
import { requireClientRole } from "@/lib/api/auth-guard";
import { getClientInvoiceById } from "@/domains/invoice/invoice.service";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireClientRole();
  if ("error" in auth) return auth.error;
  const companyId = auth.context.user.companyId;
  if (!companyId) {
    return NextResponse.json({ error: "Entreprise non associée" }, { status: 403 });
  }

  const { id } = await params;
  const invoice = await getClientInvoiceById(auth.context.user.id, companyId, id);

  if (!invoice) {
    return NextResponse.json({ error: "Facture introuvable" }, { status: 404 });
  }

  return NextResponse.json({ data: invoice, success: true });
}
