import { NextResponse } from "next/server";
import { getCompanyId, requireStaffRole } from "@/lib/api/auth-guard";
import { getCompanyDriversWithActivity } from "@/domains/delivery/delivery.service";

export async function GET() {
  const auth = await requireStaffRole("drivers:read");
  if ("error" in auth) return auth.error;

  const companyId = getCompanyId(auth.context);
  if (!companyId) {
    return NextResponse.json({ error: "Entreprise non associée" }, { status: 400 });
  }

  try {
    const drivers = await getCompanyDriversWithActivity(companyId);
    return NextResponse.json({ data: drivers, success: true });
  } catch (error) {
    console.error("GET /api/drivers failed:", error);
    return NextResponse.json(
      { error: "Impossible de charger les chauffeurs" },
      { status: 500 }
    );
  }
}
