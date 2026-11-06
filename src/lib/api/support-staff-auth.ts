import "server-only";
import { NextResponse } from "next/server";
import { getCompanyId, requireRole, requireStaffRole } from "@/lib/api/auth-guard";

export async function requireSupportStaff() {
  const auth = await requireStaffRole();
  if ("error" in auth) return auth;
  const denied = requireRole(auth.context, ["ADMIN"]);
  if (denied) return { error: denied };

  if (!auth.context.permissions.includes("support:read")) {
    return { error: NextResponse.json({ error: "Accès refusé" }, { status: 403 }) };
  }

  const companyId = getCompanyId(auth.context);
  if (!companyId) {
    return {
      error: NextResponse.json({ error: "Entreprise non associée" }, { status: 400 }),
    };
  }
  return { context: auth.context, companyId };
}
