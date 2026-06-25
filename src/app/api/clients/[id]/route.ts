import { NextResponse } from "next/server";
import { getCompanyId, requireStaffRole } from "@/lib/api/auth-guard";
import { withApiHandler } from "@/lib/api/route-handler";
import { getCompanyClientDetail } from "@/domains/client-portal/client-admin.service";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  return withApiHandler(async () => {
    const auth = await requireStaffRole("users:read");
    if ("error" in auth) return auth.error;

    const companyId = getCompanyId(auth.context);
    if (!companyId) {
      return NextResponse.json({ error: "Entreprise non associée" }, { status: 400 });
    }

    const { id } = await params;
    const detail = await getCompanyClientDetail(companyId, id);

    if (!detail) {
      return NextResponse.json({ error: "Client introuvable" }, { status: 404 });
    }

    return NextResponse.json({ data: detail, success: true });
  });
}
