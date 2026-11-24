import { NextResponse } from "next/server";
import { requireRole, requireStaffRole } from "@/lib/api/auth-guard";
import { listDemoEnvironments } from "@/domains/demo/demo-pool.service";

/** DEMO-1 : suivi des démos par le super admin (les environnements et leur état, sans donnée de visiteur). */
export async function GET() {
  const auth = await requireStaffRole("dashboard:admin");
  if ("error" in auth) return auth.error;
  const denied = requireRole(auth.context, ["SUPER_ADMIN"]);
  if (denied) return denied;

  const data = await listDemoEnvironments();
  return NextResponse.json({ data, success: true }, { headers: { "Cache-Control": "no-store" } });
}
