import { NextResponse } from "next/server";
import { getCompanyId, requireRole, requireStaffRole } from "@/lib/api/auth-guard";
import { courierStatementQuerySchema, courierStatementToCsv } from "@/domains/delivery/courier-statement";
import { getCourierStatement } from "@/domains/delivery/courier-statement.service";

/**
 * Relevé par livreur et par période (paie, sous-traitance). Lecture seule ; `format=csv` pour un export tableur.
 * L'entreprise vient de la session : aucun paramètre d'URL ne peut la remplacer.
 */
export async function GET(request: Request) {
  const auth = await requireStaffRole("drivers:read");
  if ("error" in auth) return auth.error;
  const denied = requireRole(auth.context, ["COMPANY_ADMIN", "MINI_ADMIN", "DISPATCHER"]);
  if (denied) return denied;

  const companyId = getCompanyId(auth.context);
  if (!companyId) {
    return NextResponse.json({ error: "Entreprise non associée" }, { status: 400 });
  }

  const url = new URL(request.url);
  const parsed = courierStatementQuerySchema.safeParse(Object.fromEntries(url.searchParams));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Période invalide", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { from, to, driverId, format } = parsed.data;
  const statement = await getCourierStatement({ companyId, from, to, driverId });

  if (format === "csv") {
    return new Response(courierStatementToCsv(statement), {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="releve-livreurs-${from}-${to}.csv"`,
        "Cache-Control": "private, no-store",
        ...(statement.truncated ? { "X-Statement-Truncated": "true" } : {}),
      },
    });
  }
  return NextResponse.json({ data: statement, success: true }, { headers: { "Cache-Control": "private, no-store" } });
}
