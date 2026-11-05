import { NextResponse } from "next/server";
import { requireRole, requireStaffRole } from "@/lib/api/auth-guard";
import { gatePlatformRead, gatePlatformWrite } from "@/lib/api/platform-access";
import {
  createProspectCampaign,
  createProspectCampaignSchema,
  listProspectCampaigns,
} from "@/domains/growth/prospect/prospect-campaign.service";

const noStore = { "Cache-Control": "no-store" };

/** ADMIN-ESPACE lot 5 : campagnes de prospection et leurs chiffres (envois, clics, inscriptions, réponses). */
export async function GET() {
  const auth = await requireStaffRole("dashboard:admin");
  if ("error" in auth) return auth.error;
  const denied = requireRole(auth.context, ["SUPER_ADMIN"]);
  const blocked = await gatePlatformRead(auth.context, denied, "PROSPECT_CAMPAIGNS");
  if (blocked) return blocked;

  const data = await listProspectCampaigns();
  return NextResponse.json({ data, success: true }, { headers: { "Cache-Control": "no-store" } });
}

/** Nouvelle campagne : nom, ville (le code des liens en découle) et origine des adresses. */
export async function POST(request: Request) {
  const auth = await requireStaffRole("dashboard:admin");
  if ("error" in auth) return auth.error;
  const denied = requireRole(auth.context, ["SUPER_ADMIN"]);
  const blocked = await gatePlatformWrite(auth.context, denied, "PROSPECT_CAMPAIGNS", "POST");
  if (blocked) return blocked;

  const parsed = createProspectCampaignSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Nom, ville et origine des adresses sont obligatoires." }, { status: 400, headers: noStore });
  }
  const created = await createProspectCampaign(parsed.data, auth.context.user.id);
  return NextResponse.json({ data: created, success: true }, { status: 201, headers: noStore });
}
