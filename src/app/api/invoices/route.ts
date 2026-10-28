import { NextResponse } from "next/server";
import { getCompanyId, requireRole, requireStaffRole } from "@/lib/api/auth-guard";
import {
  COMPANY_INVOICE_FILTERS,
  listCompanyInvoices,
  type CompanyInvoiceFilter,
} from "@/domains/invoice/company-invoices.service";

/** DEMO-3 : paiements de l'entreprise (payées, en attente, en retard). */
export async function GET(request: Request) {
  const auth = await requireStaffRole("invoices:read");
  if ("error" in auth) return auth.error;
  const denied = requireRole(auth.context, ["COMPANY_ADMIN", "MINI_ADMIN"]);
  if (denied) return denied;
  const companyId = getCompanyId(auth.context);
  if (!companyId) return NextResponse.json({ error: "Entreprise non associée" }, { status: 403 });

  const status = new URL(request.url).searchParams.get("status") ?? "ALL";
  if (!(COMPANY_INVOICE_FILTERS as readonly string[]).includes(status)) {
    return NextResponse.json({ error: "Filtre de statut inconnu" }, { status: 400 });
  }
  const data = await listCompanyInvoices(companyId, { status: status as CompanyInvoiceFilter });
  return NextResponse.json({ data, success: true });
}
