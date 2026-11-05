import { NextResponse } from "next/server";
import { requireRole, requireStaffRole } from "@/lib/api/auth-guard";
import { gatePlatformRead } from "@/lib/api/platform-access";
import { getDemoPoolOccupancy } from "@/domains/demo/demo-pool.service";

/** Accueil super admin : démos disponibles sur le total et visiteurs en direct. */
export async function GET() {
  const auth = await requireStaffRole("dashboard:admin");
  if ("error" in auth) return auth.error;
  const denied = requireRole(auth.context, ["SUPER_ADMIN"]);
  const blocked = await gatePlatformRead(auth.context, denied, "OVERVIEW");
  if (blocked) return blocked;

  const data = await getDemoPoolOccupancy();
  return NextResponse.json({ data, success: true }, { headers: { "Cache-Control": "no-store" } });
}
