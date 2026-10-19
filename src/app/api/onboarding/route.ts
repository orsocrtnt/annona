import { NextResponse } from "next/server";
import { getCompanyId, requireRole, requireStaffRole } from "@/lib/api/auth-guard";
import { getCompanyOnboardingStatus } from "@/domains/onboarding/onboarding.service";

export async function GET() {
  const auth = await requireStaffRole("settings:read");
  if ("error" in auth) return auth.error;

  const roleError = requireRole(auth.context, ["COMPANY_ADMIN"]);
  if (roleError) return roleError;

  const companyId = getCompanyId(auth.context);
  if (!companyId) {
    return NextResponse.json({ error: "Entreprise non associée" }, { status: 400 });
  }

  try {
    const status = await getCompanyOnboardingStatus(companyId);
    return NextResponse.json({ data: status, success: true });
  } catch (error) {
    if (error instanceof Error && error.message === "COMPANY_NOT_FOUND") {
      return NextResponse.json({ error: "Entreprise introuvable" }, { status: 404 });
    }
    throw error;
  }
}
