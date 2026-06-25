import { NextResponse } from "next/server";
import { requireStaffRole } from "@/lib/api/auth-guard";
import { getPlatformOverview } from "@/domains/admin/platform.service";

export async function GET() {
  // dashboard:admin n'est attribué qu'au SUPER_ADMIN → réservé à la plateforme.
  const auth = await requireStaffRole("dashboard:admin");
  if ("error" in auth) return auth.error;

  const data = await getPlatformOverview();
  return NextResponse.json({ data, success: true });
}
