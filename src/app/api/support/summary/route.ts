import { NextResponse } from "next/server";
import { countNewStaffTickets } from "@/domains/support/support.service";
import { requireSupportStaff } from "@/lib/api/support-staff-auth";
import { withApiHandler } from "@/lib/api/route-handler";

/** RETOURS-3 : nombre de demandes de support nouvelles de l'entreprise (pastille rouge du menu du gérant). */
export async function GET() {
  return withApiHandler(async () => {
    const auth = await requireSupportStaff();
    if ("error" in auth) return auth.error;
    const openTickets = await countNewStaffTickets(auth.companyId);
    return NextResponse.json({ data: { openTickets }, success: true });
  });
}
