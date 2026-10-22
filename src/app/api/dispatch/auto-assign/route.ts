import { NextResponse } from "next/server";
import { getCompanyId, requireStaffRole } from "@/lib/api/auth-guard";
import { withApiHandler } from "@/lib/api/route-handler";
import { runAutoDispatchQueue } from "@/domains/delivery/auto-dispatch.service";
import { assertSaasMutationFeature } from "@/domains/saas/saas.service";

export async function POST() {
  return withApiHandler(async () => {
    const auth = await requireStaffRole("deliveries:dispatch");
    if ("error" in auth) return auth.error;

    const companyId = getCompanyId(auth.context);
    if (!companyId) {
      return NextResponse.json({ error: "Entreprise non associée" }, { status: 400 });
    }

    try {
      await assertSaasMutationFeature(companyId, "auto_dispatch");
    } catch (error) {
      if (error instanceof Error && error.message === "SAAS_FEATURE_NOT_AVAILABLE") {
        return NextResponse.json({ error: "Le dispatch automatique n’est pas inclus dans cette offre." }, { status: 403 });
      }
      if (error instanceof Error && error.message === "SAAS_ACCOUNT_READ_ONLY") {
        return NextResponse.json({ error: "Le compte est en lecture seule." }, { status: 403 });
      }
      throw error;
    }

    const result = await runAutoDispatchQueue(companyId);
    return NextResponse.json({ data: result, success: true });
  });
}
