import { NextResponse } from "next/server";
import { requireRole, requireStaffRole } from "@/lib/api/auth-guard";
import { gatePlatformWrite } from "@/lib/api/platform-access";
import {
  prospectLinkBaseUrl,
  prospectSendSchema,
  sendNextProspectEmail,
  sendProspectTestEmail,
} from "@/domains/growth/prospect/prospect-campaign.service";

const noStore = { "Cache-Control": "no-store" };
const NOT_CONFIGURED = "Envoi pas encore configuré : le mot de passe de la boîte orso@tutelliv.fr manque dans Vercel.";

/**
 * ADMIN-ESPACE lot 5 : `next` envoie le mail suivant de la campagne (un seul par appel, espacés côté serveur),
 * `test` envoie un essai à l'adresse du super-administrateur connecté.
 */
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireStaffRole("dashboard:admin");
  if ("error" in auth) return auth.error;
  const denied = requireRole(auth.context, ["SUPER_ADMIN"]);
  const blocked = await gatePlatformWrite(auth.context, denied, "PROSPECT_CAMPAIGNS", "POST");
  if (blocked) return blocked;

  const parsed = prospectSendSchema.safeParse(await request.json().catch(() => null));
  const { id } = await context.params;
  if (!parsed.success || !id || id.length > 64) {
    return NextResponse.json({ error: "Action invalide" }, { status: 400, headers: noStore });
  }
  const baseUrl = prospectLinkBaseUrl(request.url);

  if (parsed.data.mode === "test") {
    const result = await sendProspectTestEmail(id, auth.context.user.email, baseUrl);
    if (result.status === "not_found") return NextResponse.json({ error: "Campagne introuvable" }, { status: 404, headers: noStore });
    if (result.status === "not_configured") return NextResponse.json({ error: NOT_CONFIGURED }, { status: 409, headers: noStore });
    if (result.status === "failed") return NextResponse.json({ error: result.detail }, { status: 502, headers: noStore });
    return NextResponse.json({ data: result, success: true }, { headers: noStore });
  }

  const result = await sendNextProspectEmail(id, baseUrl);
  if (result.status === "not_found") return NextResponse.json({ error: "Campagne introuvable" }, { status: 404, headers: noStore });
  if (result.status === "not_configured") return NextResponse.json({ error: NOT_CONFIGURED }, { status: 409, headers: noStore });
  return NextResponse.json({ data: result, success: true }, { headers: noStore });
}
