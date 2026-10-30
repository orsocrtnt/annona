import { NextResponse } from "next/server";
import { z } from "zod";
import { getCompanyId, requireRole, requireStaffRole } from "@/lib/api/auth-guard";
import { withApiHandler } from "@/lib/api/route-handler";
import { confirmAutoDispatch, previewAutoDispatch, runAutoDispatchQueue } from "@/domains/delivery/auto-dispatch.service";
import { assertSaasMutationFeature } from "@/domains/saas/saas.service";

const confirmSchema = z.object({
  assignments: z.array(z.object({ deliveryId: z.string().min(1), driverId: z.string().min(1) })).min(1).max(200),
}).strict();

export async function GET() {
  return withApiHandler(async () => {
    const auth = await requireStaffRole("deliveries:dispatch");
    if ("error" in auth) return auth.error;
    const denied = requireRole(auth.context, ["COMPANY_ADMIN", "MINI_ADMIN", "DISPATCHER"]);
    if (denied) return denied;
    const companyId = getCompanyId(auth.context);
    if (!companyId) return NextResponse.json({ error: "Entreprise non associée" }, { status: 400 });
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
    return NextResponse.json({ data: await previewAutoDispatch(companyId), success: true });
  });
}

export async function POST(request: Request) {
  return withApiHandler(async () => {
    const auth = await requireStaffRole("deliveries:dispatch");
    if ("error" in auth) return auth.error;
    const denied = requireRole(auth.context, ["COMPANY_ADMIN", "MINI_ADMIN", "DISPATCHER"]);
    if (denied) return denied;

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

    // Avec un corps : seules les propositions validées. Sans corps : « Ne plus me demander », tout de suite.
    const body = await request.json().catch(() => null);
    if (body) {
      const parsed = confirmSchema.safeParse(body);
      if (!parsed.success) return NextResponse.json({ error: "Données invalides" }, { status: 400 });
      return NextResponse.json({ data: await confirmAutoDispatch(companyId, parsed.data.assignments), success: true });
    }

    const result = await runAutoDispatchQueue(companyId);
    return NextResponse.json({ data: result, success: true });
  });
}
