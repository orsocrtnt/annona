import { NextResponse } from "next/server";
import { getCompanyId, requireRole, requireStaffRole } from "@/lib/api/auth-guard";
import { getDriverDispatchWorkload } from "@/domains/delivery/delivery.service";

export async function GET() {
  const auth = await requireStaffRole("deliveries:read");
  if ("error" in auth) return auth.error;
  const denied = requireRole(auth.context, ["COMPANY_ADMIN", "MINI_ADMIN", "DISPATCHER"]);
  if (denied) return denied;

  const companyId = getCompanyId(auth.context);
  if (!companyId) {
    return NextResponse.json({ error: "Entreprise non associée" }, { status: 400 });
  }

  try {
    const workload = await getDriverDispatchWorkload(companyId);
    return NextResponse.json({ data: workload, success: true });
  } catch (error) {
    console.error("GET /api/dispatch/drivers-workload failed:", error);
    return NextResponse.json(
      { error: "Impossible de charger la charge des livreurs" },
      { status: 500 }
    );
  }
}
