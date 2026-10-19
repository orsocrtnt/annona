import { NextResponse } from "next/server";
import { exportOrderHistoryCsv } from "@/domains/order/order.service";
import { getCompanyId, requireStaffRole } from "@/lib/api/auth-guard";
import { parseOrderHistoryQuery } from "@/lib/validations/order-history";

export async function GET(request: Request) {
  const auth = await requireStaffRole("orders:read");
  if ("error" in auth) return auth.error;
  const companyId = getCompanyId(auth.context);
  if (!companyId) return NextResponse.json({ error: "Entreprise non associée" }, { status: 403 });

  const parsed = parseOrderHistoryQuery(request.url);
  if (!parsed.success) {
    return NextResponse.json({ error: "Filtres invalides", details: parsed.error.flatten() }, { status: 400 });
  }
  const csv = await exportOrderHistoryCsv(companyId, parsed.data, { includeCustomer: true });
  const date = new Date().toISOString().slice(0, 10);
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="tutelliv-commandes-${date}.csv"`,
      "Cache-Control": "private, no-store",
    },
  });
}
