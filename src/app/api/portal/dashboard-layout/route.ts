import { NextResponse } from "next/server";
import { requireClientRole } from "@/lib/api/auth-guard";
import { readJsonBody, withApiHandler } from "@/lib/api/route-handler";
import {
  getPortalDashboardLayout,
  resetPortalDashboardLayout,
  updatePortalDashboardLayout,
} from "@/domains/client-portal/portal-dashboard-settings.service";
import { portalDashboardLayoutSchema } from "@/lib/validations/portal-dashboard-layout";

export async function GET() {
  return withApiHandler(async () => {
    const auth = await requireClientRole();
    if ("error" in auth) return auth.error;

    const layout = await getPortalDashboardLayout(auth.context.user.id);
    return NextResponse.json({ data: layout, success: true });
  });
}

export async function PATCH(request: Request) {
  return withApiHandler(async () => {
    const auth = await requireClientRole();
    if ("error" in auth) return auth.error;

    const body = await readJsonBody(request);
    const parsed = portalDashboardLayoutSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Données invalides" },
        { status: 400 }
      );
    }

    const layout = await updatePortalDashboardLayout(auth.context.user.id, parsed.data);
    return NextResponse.json({ data: layout, success: true });
  });
}

export async function DELETE() {
  return withApiHandler(async () => {
    const auth = await requireClientRole();
    if ("error" in auth) return auth.error;

    const layout = await resetPortalDashboardLayout(auth.context.user.id);
    return NextResponse.json({ data: layout, success: true });
  });
}
