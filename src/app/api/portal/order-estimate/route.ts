import { NextResponse } from "next/server";
import { requireClientRole } from "@/lib/api/auth-guard";
import { withApiHandler } from "@/lib/api/route-handler";
import { estimateCourierPrice } from "@/domains/company/courier-estimate.service";
import { courierEstimateRequestSchema } from "@/lib/validations/courier-estimate";

export async function POST(request: Request) {
  return withApiHandler(async () => {
    const auth = await requireClientRole();
    if ("error" in auth) return auth.error;

    const companyId = auth.context.user.companyId;
    if (!companyId) {
      return NextResponse.json({ error: "Entreprise non associée" }, { status: 400 });
    }

    const parsed = courierEstimateRequestSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: "Données d'estimation invalides." }, { status: 400 });
    }

    const result = await estimateCourierPrice(companyId, parsed.data);

    return NextResponse.json({ data: result, success: true });
  });
}
