import { NextResponse } from "next/server";
import { getCompanyId, requireRole, requireStaffRole } from "@/lib/api/auth-guard";
import { withApiHandler } from "@/lib/api/route-handler";
import { estimateCourierPrice } from "@/domains/company/courier-estimate.service";
import { courierEstimateRequestSchema } from "@/lib/validations/courier-estimate";

/** Estimation d'une course pendant la saisie par l'équipe : mêmes droits que la création de commande. */
export async function POST(request: Request) {
  return withApiHandler(async () => {
    const auth = await requireStaffRole("orders:create");
    if ("error" in auth) return auth.error;
    const denied = requireRole(auth.context, ["COMPANY_ADMIN", "MINI_ADMIN", "DISPATCHER"]);
    if (denied) return denied;
    const companyId = getCompanyId(auth.context);
    if (!companyId) return NextResponse.json({ error: "Entreprise non associée" }, { status: 400 });

    const parsed = courierEstimateRequestSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: "Données d'estimation invalides." }, { status: 400 });
    }

    return NextResponse.json({ data: await estimateCourierPrice(companyId, parsed.data), success: true });
  });
}
