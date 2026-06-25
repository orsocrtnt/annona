import { NextResponse } from "next/server";
import { requireStaffRole } from "@/lib/api/auth-guard";
import { withApiHandler } from "@/lib/api/route-handler";
import {
  getDashboardLayout,
  resetDashboardLayout,
  updateDashboardLayout,
} from "@/domains/back-office/dashboard-settings.service";
import { dashboardLayoutSchema } from "@/lib/validations/dashboard-layout";

export async function GET() {
  return withApiHandler(async () => {
    const auth = await requireStaffRole("orders:read");
    if ("error" in auth) return auth.error;

    const layout = await getDashboardLayout(auth.context.user.id);
    return NextResponse.json({ data: layout, success: true });
  });
}

export async function PATCH(request: Request) {
  return withApiHandler(async () => {
    const auth = await requireStaffRole("orders:read");
    if ("error" in auth) return auth.error;

    const body = await request.json();
    const parsed = dashboardLayoutSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Données invalides", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const layout = await updateDashboardLayout(auth.context.user.id, parsed.data);
    return NextResponse.json({ data: layout, success: true });
  });
}

export async function DELETE() {
  return withApiHandler(async () => {
    const auth = await requireStaffRole("orders:read");
    if ("error" in auth) return auth.error;

    const layout = await resetDashboardLayout(auth.context.user.id);
    return NextResponse.json({ data: layout, success: true });
  });
}
