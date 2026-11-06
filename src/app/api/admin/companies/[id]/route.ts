import { NextResponse } from "next/server";
import { requireRole, requireStaffRole } from "@/lib/api/auth-guard";
import { getPlatformCompanyFile } from "@/domains/admin/company-file.service";

/** Fiche entreprise du super-administrateur (ADMIN-ESPACE lot 3) : identité et activité. */
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireStaffRole("dashboard:admin");
  if ("error" in auth) return auth.error;
  const denied = requireRole(auth.context, ["SUPER_ADMIN"]);
  if (denied) return denied;

  const { id } = await context.params;
  let data;
  try {
    data = await getPlatformCompanyFile(id);
  } catch {
    return NextResponse.json({ error: "Fiche entreprise indisponible." }, { status: 500, headers: { "Cache-Control": "no-store" } });
  }
  if (!data) {
    return NextResponse.json({ error: "Entreprise introuvable" }, { status: 404, headers: { "Cache-Control": "no-store" } });
  }
  return NextResponse.json({ data, success: true }, { headers: { "Cache-Control": "no-store" } });
}
