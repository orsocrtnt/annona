import { NextResponse } from "next/server";
import { requireRole, requireStaffRole } from "@/lib/api/auth-guard";
import { gatePlatformRead, gatePlatformWrite } from "@/lib/api/platform-access";
import {
  adjustProspectReplies,
  deleteProspectCampaign,
  prospectRepliesSchema,
  readProspectCampaign,
} from "@/domains/growth/prospect/prospect-campaign.service";

const noStore = { "Cache-Control": "no-store" };
type Params = { params: Promise<{ id: string }> };

/** ADMIN-ESPACE lot 5 : une campagne, ses chiffres et ses destinataires. */
export async function GET(_request: Request, context: Params) {
  const auth = await requireStaffRole("dashboard:admin");
  if ("error" in auth) return auth.error;
  const denied = requireRole(auth.context, ["SUPER_ADMIN"]);
  const blocked = await gatePlatformRead(auth.context, denied, "PROSPECT_CAMPAIGNS");
  if (blocked) return blocked;

  const { id } = await context.params;
  if (!id || id.length > 64) return NextResponse.json({ error: "Campagne introuvable" }, { status: 404, headers: noStore });
  const data = await readProspectCampaign(id);
  if (!data) return NextResponse.json({ error: "Campagne introuvable" }, { status: 404, headers: noStore });
  return NextResponse.json({ data, success: true }, { headers: { "Cache-Control": "no-store" } });
}

/** Réponses reçues : +1 ou −1, saisies à la main (jamais en dessous de zéro). */
export async function PATCH(request: Request, context: Params) {
  const auth = await requireStaffRole("dashboard:admin");
  if ("error" in auth) return auth.error;
  const denied = requireRole(auth.context, ["SUPER_ADMIN"]);
  const blocked = await gatePlatformWrite(auth.context, denied, "PROSPECT_CAMPAIGNS", "PATCH");
  if (blocked) return blocked;

  const parsed = prospectRepliesSchema.safeParse(await request.json().catch(() => null));
  const { id } = await context.params;
  if (!parsed.success || !id || id.length > 64) {
    return NextResponse.json({ error: "Action invalide" }, { status: 400, headers: noStore });
  }
  const replies = await adjustProspectReplies(id, parsed.data.delta);
  if (replies === null) return NextResponse.json({ error: "Campagne introuvable" }, { status: 404, headers: noStore });
  return NextResponse.json({ data: { replies }, success: true }, { headers: noStore });
}

/** Supprime la campagne et ses adresses ; les adresses STOP restent bloquées pour toutes les campagnes. */
export async function DELETE(_request: Request, context: Params) {
  const auth = await requireStaffRole("dashboard:admin");
  if ("error" in auth) return auth.error;
  const denied = requireRole(auth.context, ["SUPER_ADMIN"]);
  const blocked = await gatePlatformWrite(auth.context, denied, "PROSPECT_CAMPAIGNS", "DELETE");
  if (blocked) return blocked;

  const { id } = await context.params;
  if (!id || id.length > 64) return NextResponse.json({ error: "Campagne introuvable" }, { status: 404, headers: noStore });
  const outcome = await deleteProspectCampaign(id);
  if (outcome === "not_found") return NextResponse.json({ error: "Campagne introuvable" }, { status: 404, headers: noStore });
  if (outcome === "sending") {
    return NextResponse.json(
      { error: "Un mail de cette campagne est en cours d'envoi : mettez l'envoi en pause, puis réessayez." },
      { status: 409, headers: noStore }
    );
  }
  return NextResponse.json({ data: { deleted: true }, success: true }, { headers: noStore });
}
