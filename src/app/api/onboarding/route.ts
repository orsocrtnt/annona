import { z } from "zod";
import { NextResponse } from "next/server";
import { getCompanyId, requireRole, requireStaffRole } from "@/lib/api/auth-guard";
import { getCompanyOnboardingStatus, onboardingPreferenceSchema, onboardingCompanyProfileSchema, updateOnboardingPreference, updateOnboardingCompanyProfile } from "@/domains/onboarding/onboarding.service";


const updateSchema = z.union([onboardingPreferenceSchema, z.object({ step: z.literal("company"), profile: onboardingCompanyProfileSchema }).strict()]);

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

export async function PATCH(request: Request) {
  const auth = await requireStaffRole("settings:update");
  if ("error" in auth) return auth.error;
  const roleError = requireRole(auth.context, ["COMPANY_ADMIN"]);
  if (roleError) return roleError;
  const companyId = getCompanyId(auth.context);
  if (!companyId) return NextResponse.json({ error: "Entreprise non associée" }, { status: 400 });

  const parsed = updateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Informations ou choix d’étape invalides" }, { status: 400 });
  try {
    if (parsed.data.step === "company") await updateOnboardingCompanyProfile(companyId, parsed.data.profile);
    else await updateOnboardingPreference(companyId, parsed.data);
    return NextResponse.json({ data: await getCompanyOnboardingStatus(companyId), success: true });
  } catch (error) {
    if (error instanceof Error && error.message === "COMPANY_NOT_FOUND") {
      return NextResponse.json({ error: "Entreprise introuvable" }, { status: 404 });
    }
    if (error instanceof Error && error.message === "ONBOARDING_CONFLICT") {
      return NextResponse.json({ error: "Les réglages ont changé. Réessayez." }, { status: 409 });
    }
    throw error;
  }
}
