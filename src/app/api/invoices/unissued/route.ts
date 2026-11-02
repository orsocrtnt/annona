import { NextResponse } from "next/server";
import { getCompanyId, requireRole, requireStaffRole } from "@/lib/api/auth-guard";
import { listUnissuedDeliveryInvoices } from "@/domains/invoice/company-invoices.service";

/** FACT-AUTO-VIDE : commandes livrées que la facture automatique n'a pas pu facturer. */
export async function GET() {
  const auth = await requireStaffRole("invoices:read");
  if ("error" in auth) return auth.error;
  const denied = requireRole(auth.context, ["COMPANY_ADMIN", "MINI_ADMIN"]);
  if (denied) return denied;
  const companyId = getCompanyId(auth.context);
  if (!companyId) return NextResponse.json({ error: "Entreprise non associée" }, { status: 403 });
  return NextResponse.json({ data: await listUnissuedDeliveryInvoices(companyId), success: true });
}
