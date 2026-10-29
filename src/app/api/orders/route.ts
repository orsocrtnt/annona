import { NextResponse } from "next/server";
import { getCompanyId, requireRole, requireStaffRole } from "@/lib/api/auth-guard";
import { withApiHandler } from "@/lib/api/route-handler";
import { listCompanyOrderHistory } from "@/domains/order/order.service";
import { parseOrderHistoryQuery } from "@/lib/validations/order-history";

export async function GET(request: Request) {
  return withApiHandler(async () => {
    const auth = await requireStaffRole("orders:read");
    if ("error" in auth) return auth.error;
    const denied = requireRole(auth.context, ["COMPANY_ADMIN", "MINI_ADMIN", "DISPATCHER"]);
    if (denied) return denied;

    const companyId = getCompanyId(auth.context);
    if (!companyId) {
      return NextResponse.json({ error: "Entreprise non associée" }, { status: 400 });
    }

    const parsed = parseOrderHistoryQuery(request.url);
    if (!parsed.success) {
      return NextResponse.json({ error: "Filtres invalides" }, { status: 400 });
    }

    const result = await listCompanyOrderHistory(companyId, parsed.data);
    return NextResponse.json({ data: result, success: true });
  });
}
