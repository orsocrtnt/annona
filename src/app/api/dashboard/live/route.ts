import { NextResponse } from "next/server";
import { getLiveDashboard, liveCompanyFrom } from "@/domains/round/round-live.service";
import { withApiHandler } from "@/lib/api/route-handler";
import { requireCompanyAdminAny } from "@/lib/api/tenant-auth";

/** ADM-04, ADM-08 : suivi en direct du jour (rafraîchi par l'écran toutes les 15 s). */
export async function GET() {
  return withApiHandler(async () => {
    // Lot 1, demande 4 : tableau de bord et écran des tournées (fonctionnalités séparées).
    const guard = await requireCompanyAdminAny(["dashboard:company", "rounds:read"]);
    if ("error" in guard) return guard.error;
    // LOT1-D9 : l'entreprise est déjà lue avec le compte, inutile de la relire.
    return NextResponse.json({ data: await getLiveDashboard(guard.actor.companyId, { company: liveCompanyFrom(guard.actor.user.company) }), success: true });
  });
}
