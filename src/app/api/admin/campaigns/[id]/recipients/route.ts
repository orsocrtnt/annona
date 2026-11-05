import { NextResponse } from "next/server";
import { requireRole, requireStaffRole } from "@/lib/api/auth-guard";
import { gatePlatformWrite } from "@/lib/api/platform-access";
import {
  PROSPECT_MAX_ADDRESSES_PER_PASTE,
  addProspectRecipients,
  prospectAddressesSchema,
} from "@/domains/growth/prospect/prospect-campaign.service";

const noStore = { "Cache-Control": "no-store" };

/** ADMIN-ESPACE lot 5 : adresses collées ; doublons et adresses STOP écartés. */
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireStaffRole("dashboard:admin");
  if ("error" in auth) return auth.error;
  const denied = requireRole(auth.context, ["SUPER_ADMIN"]);
  const blocked = await gatePlatformWrite(auth.context, denied, "PROSPECT_CAMPAIGNS", "POST");
  if (blocked) return blocked;

  const parsed = prospectAddressesSchema.safeParse(await request.json().catch(() => null));
  const { id } = await context.params;
  if (!parsed.success || !id || id.length > 64) {
    return NextResponse.json({ error: "Liste d'adresses invalide" }, { status: 400, headers: noStore });
  }
  const outcome = await addProspectRecipients(id, parsed.data.addresses);
  if (outcome.status === "not_found") return NextResponse.json({ error: "Campagne introuvable" }, { status: 404, headers: noStore });
  if (outcome.status === "too_many") {
    return NextResponse.json(
      { error: `${PROSPECT_MAX_ADDRESSES_PER_PASTE} adresses au plus à la fois.` },
      { status: 400, headers: noStore }
    );
  }
  return NextResponse.json({ data: outcome.result, success: true }, { headers: noStore });
}
