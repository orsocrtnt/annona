import { NextResponse } from "next/server";
import { getCompanyId, requireRole, requireStaffRole } from "@/lib/api/auth-guard";
import { withApiHandler } from "@/lib/api/route-handler";
import { getEligibleDriversForDelivery } from "@/domains/delivery/auto-dispatch.service";

export async function GET(request: Request) {
  return withApiHandler(async () => {
    const auth = await requireStaffRole("deliveries:dispatch");
    if ("error" in auth) return auth.error;
    const denied = requireRole(auth.context, ["COMPANY_ADMIN", "MINI_ADMIN", "DISPATCHER"]);
    if (denied) return denied;

    const companyId = getCompanyId(auth.context);
    if (!companyId) {
      return NextResponse.json({ error: "Entreprise non associée" }, { status: 400 });
    }

    const deliveryId = new URL(request.url).searchParams.get("deliveryId");
    if (!deliveryId) {
      return NextResponse.json({ error: "deliveryId requis" }, { status: 400 });
    }

    const result = await getEligibleDriversForDelivery(companyId, deliveryId);
    if (!result) {
      return NextResponse.json({ error: "Livraison introuvable" }, { status: 404 });
    }

    return NextResponse.json({ data: result, success: true });
  });
}
