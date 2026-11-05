import { NextResponse } from "next/server";
import { requireRole, requireStaffRole } from "@/lib/api/auth-guard";
import { gatePlatformWrite } from "@/lib/api/platform-access";
import {
  PROSPECT_MAX_ADDRESSES_PER_PASTE,
  addProspectOptOuts,
  prospectAddressesSchema,
} from "@/domains/growth/prospect/prospect-campaign.service";

const noStore = { "Cache-Control": "no-store" };

/** ADMIN-ESPACE lot 5 : adresses qui ont répondu STOP, bloquées pour toutes les campagnes. */
export async function POST(request: Request) {
  const auth = await requireStaffRole("dashboard:admin");
  if ("error" in auth) return auth.error;
  const denied = requireRole(auth.context, ["SUPER_ADMIN"]);
  const blocked = await gatePlatformWrite(auth.context, denied, "PROSPECT_CAMPAIGNS", "POST");
  if (blocked) return blocked;

  const parsed = prospectAddressesSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Liste d'adresses invalide" }, { status: 400, headers: noStore });
  const outcome = await addProspectOptOuts(parsed.data.addresses, auth.context.user.id);
  if (outcome.status === "too_many") {
    return NextResponse.json(
      { error: `${PROSPECT_MAX_ADDRESSES_PER_PASTE} adresses au plus à la fois.` },
      { status: 400, headers: noStore }
    );
  }
  return NextResponse.json({ data: outcome, success: true }, { headers: noStore });
}
