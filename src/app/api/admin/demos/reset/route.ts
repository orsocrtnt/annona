import { after, NextResponse } from "next/server";
import { requireRole, requireStaffRole } from "@/lib/api/auth-guard";
import { prepareSpareDemoEnvironment, releaseAllDemoLeases } from "@/domains/demo/demo-pool.service";

/**
 * DEMO-1 « Tout déconnecter » (super admin) : tous les visiteurs sortent de leur démo, chaque environnement est
 * reconstruit avant d'être prêté de nouveau ; une démo remise à neuf est préparée après la réponse.
 */
export async function POST() {
  const auth = await requireStaffRole("dashboard:admin");
  if ("error" in auth) return auth.error;
  const denied = requireRole(auth.context, ["SUPER_ADMIN"]);
  if (denied) return denied;

  const data = await releaseAllDemoLeases();
  after(() => prepareSpareDemoEnvironment().catch((error) => console.error("[demo] réserve non préparée", error)));
  return NextResponse.json({ data, success: true }, { headers: { "Cache-Control": "no-store" } });
}
