import { NextResponse } from "next/server";
import { exportOrderHistoryCsv } from "@/domains/order/order.service";
import { requireClientRole } from "@/lib/api/auth-guard";
import { parseOrderHistoryQuery } from "@/lib/validations/order-history";

export async function GET(request: Request) {
  const auth = await requireClientRole();
  if ("error" in auth) return auth.error;
  const companyId = auth.context.user.companyId;
  if (!companyId) return NextResponse.json({ error: "Entreprise non associée" }, { status: 403 });

  const parsed = parseOrderHistoryQuery(request.url);
  if (!parsed.success) {
    return NextResponse.json({ error: "Filtres invalides" }, { status: 400 });
  }
  const csv = await exportOrderHistoryCsv(companyId, parsed.data, {
    customerId: auth.context.user.id,
  });
  const date = new Date().toISOString().slice(0, 10);
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="mes-commandes-${date}.csv"`,
      "Cache-Control": "private, no-store",
    },
  });
}
