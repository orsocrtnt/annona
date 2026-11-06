import { NextResponse } from "next/server";
import { exportAccountingCsv } from "@/domains/invoice/accounting-export.service";
import { getCompanyId, requireRole, requireStaffRole } from "@/lib/api/auth-guard";
import { parseAccountingExportQuery } from "@/lib/validations/accounting-export";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const auth = await requireStaffRole("invoices:read");
  if ("error" in auth) return auth.error;
  const denied = requireRole(auth.context, ["COMPANY_ADMIN", "MINI_ADMIN"]);
  if (denied) return denied;
  const companyId = getCompanyId(auth.context);
  if (!companyId) return NextResponse.json({ error: "Entreprise non associée" }, { status: 403 });
  const parsed = parseAccountingExportQuery(request.url);
  if (!parsed.success) return NextResponse.json({ error: "Période UTC et statut explicites requis" }, { status: 400 });
  try {
    const csv = await exportAccountingCsv(companyId, parsed.data);
    return new Response(csv, { headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="annona-prestations-v1-${parsed.data.from}-${parsed.data.to}.csv"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    } });
  } catch (error) {
    if (error instanceof Error && error.message === "ACCOUNTING_EXPORT_TOO_LARGE") {
      return NextResponse.json({ error: "Export trop volumineux : réduisez la période ou filtrez le statut." }, { status: 422 });
    }
    // No document identifier or content in errors or logs.
    return NextResponse.json({ error: "Export indisponible. Vérifiez les documents ou réessayez." }, { status: 503 });
  }
}
