import { NextResponse } from "next/server";
import { getCompanyId, requireStaffRole } from "@/lib/api/auth-guard";
import { getDriverDispatchWorkload } from "@/domains/delivery/delivery.service";

export async function GET() {
  const auth = await requireStaffRole("deliveries:read");
  if ("error" in auth) return auth.error;

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
      { error: "Impossible de charger la charge des chauffeurs" },
      { status: 500 }
    );
  }
}
