import { NextResponse } from "next/server";
import { requireRole, requireStaffRole } from "@/lib/api/auth-guard";
import { listPlatformCompanies, parseCompanyListParams } from "@/domains/admin/companies.service";

export async function GET(request: Request) {
  const auth = await requireStaffRole("dashboard:admin");
  if ("error" in auth) return auth.error;
  const denied = requireRole(auth.context, ["SUPER_ADMIN"]);
  if (denied) return denied;

  const parsed = parseCompanyListParams(new URL(request.url).searchParams);
  if ("error" in parsed) {
    return NextResponse.json({ error: parsed.error }, { status: 400, headers: { "Cache-Control": "no-store" } });
  }

  const data = await listPlatformCompanies(parsed.query);
  return NextResponse.json(
    { data, success: true },
    { headers: { "Cache-Control": "no-store" } }
  );
}
