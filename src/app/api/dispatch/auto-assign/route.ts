import { NextResponse } from "next/server";
import { getCompanyId, requireStaffRole } from "@/lib/api/auth-guard";
import { withApiHandler } from "@/lib/api/route-handler";
import { runAutoDispatchQueue } from "@/domains/delivery/auto-dispatch.service";

export async function POST() {
  return withApiHandler(async () => {
    const auth = await requireStaffRole("deliveries:dispatch");
    if ("error" in auth) return auth.error;

    const companyId = getCompanyId(auth.context);
    if (!companyId) {
      return NextResponse.json({ error: "Entreprise non associée" }, { status: 400 });
    }

    const result = await runAutoDispatchQueue(companyId);
    return NextResponse.json({ data: result, success: true });
  });
}
