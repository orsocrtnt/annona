import { NextResponse } from "next/server";
import { requireRole, requireStaffRole } from "@/lib/api/auth-guard";
import { readPlatformServiceHealth } from "@/domains/admin/service-health.service";

export async function GET() {
  const auth = await requireStaffRole("dashboard:admin");
  if ("error" in auth) return auth.error;
  const denied = requireRole(auth.context, ["SUPER_ADMIN"]);
  if (denied) return denied;

  try {
    const data = await readPlatformServiceHealth();
    return NextResponse.json(
      { data, success: true },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch {
    return NextResponse.json(
      { error: "Santé des services indisponible." },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}
