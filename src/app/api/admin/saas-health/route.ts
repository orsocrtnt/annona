import { NextResponse } from "next/server";
import { requireRole, requireStaffRole } from "@/lib/api/auth-guard";
import { gatePlatformRead } from "@/lib/api/platform-access";
import { getSaasHealthIndicators } from "@/domains/admin/saas-health.service";

export async function GET() {
  const auth = await requireStaffRole("dashboard:admin");
  if ("error" in auth) return auth.error;
  const denied = requireRole(auth.context, ["SUPER_ADMIN"]);
  const blocked = await gatePlatformRead(auth.context, denied, "SAAS_HEALTH");
  if (blocked) return blocked;

  try {
    const data = await getSaasHealthIndicators();
    return NextResponse.json(
      { data, success: true },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch {
    return NextResponse.json(
      { error: "Indicateurs SaaS indisponibles." },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}
