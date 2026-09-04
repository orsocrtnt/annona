import { NextResponse } from "next/server";
import { getCompanyId, requireStaffRole } from "@/lib/api/auth-guard";
import { withApiHandler } from "@/lib/api/route-handler";
import { getCompanyClients } from "@/domains/client-portal/client-admin.service";

export async function GET() {
  return withApiHandler(async () => {
    const auth = await requireStaffRole("orders:read");
    if ("error" in auth) return auth.error;

    const companyId = getCompanyId(auth.context);
    if (!companyId) {
      return NextResponse.json({ error: "Entreprise non associée" }, { status: 400 });
    }

    const clients = await getCompanyClients(companyId);
    return NextResponse.json({ data: clients, success: true });
  });
}
