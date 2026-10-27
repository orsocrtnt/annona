import { NextResponse } from "next/server";
import { requireRole, requireStaffRole } from "@/lib/api/auth-guard";
import { gatePlatformRead } from "@/lib/api/platform-access";
import { getPlatformCompany } from "@/domains/admin/companies.service";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireStaffRole("dashboard:admin");
  if ("error" in auth) return auth.error;
  const denied = requireRole(auth.context, ["SUPER_ADMIN"]);
  const blocked = await gatePlatformRead(auth.context, denied, "COMPANY_DETAIL");
  if (blocked) return blocked;

  const { id } = await context.params;
  const data = await getPlatformCompany(id);
  if (!data) {
    return NextResponse.json({ error: "Entreprise introuvable" }, { status: 404, headers: { "Cache-Control": "no-store" } });
  }
  return NextResponse.json({ data, success: true }, { headers: { "Cache-Control": "no-store" } });
}
