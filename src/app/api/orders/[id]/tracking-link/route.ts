import { NextResponse } from "next/server";
import { getCompanyId, requireRole, requireStaffRole } from "@/lib/api/auth-guard";
import { withApiHandler } from "@/lib/api/route-handler";
import { getOrCreateTrackingLink } from "@/domains/public-order/public-order.service";

/** Lien de suivi sans connexion, à transmettre au client ou au destinataire. */
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  return withApiHandler(async () => {
    const auth = await requireStaffRole("orders:read");
    if ("error" in auth) return auth.error;
    const denied = requireRole(auth.context, ["COMPANY_ADMIN", "MINI_ADMIN", "DISPATCHER"]);
    if (denied) return denied;
    const companyId = getCompanyId(auth.context);
    if (!companyId) return NextResponse.json({ error: "Entreprise non associée" }, { status: 400 });
    const { id } = await params;
    const link = await getOrCreateTrackingLink(companyId, id);
    if (!link) return NextResponse.json({ error: "Commande introuvable" }, { status: 404 });
    return NextResponse.json({ success: true, data: link });
  });
}
