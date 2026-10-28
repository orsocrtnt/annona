import { NextResponse } from "next/server";
import { getCompanyId, requireRole, requireStaffRole } from "@/lib/api/auth-guard";
import { readJsonBody, withApiHandler } from "@/lib/api/route-handler";
import {
  getCompanyBillingSettings,
  updateCompanyBillingSettings,
} from "@/domains/company/billing-settings.service";
import { companyBillingSettingsSchema } from "@/lib/validations/billing-settings";

export async function GET() {
  return withApiHandler(async () => {
    const auth = await requireStaffRole("settings:read");
    if ("error" in auth) return auth.error;
    const denied = requireRole(auth.context, ["COMPANY_ADMIN", "MINI_ADMIN"]);
    if (denied) return denied;

    const companyId = getCompanyId(auth.context);
    if (!companyId) {
      return NextResponse.json({ error: "Entreprise non associée" }, { status: 400 });
    }

    const settings = await getCompanyBillingSettings(companyId);
    return NextResponse.json({ data: settings, success: true });
  });
}

export async function PATCH(request: Request) {
  return withApiHandler(async () => {
    const auth = await requireStaffRole("settings:update");
    if ("error" in auth) return auth.error;
    const denied = requireRole(auth.context, ["COMPANY_ADMIN", "MINI_ADMIN"]);
    if (denied) return denied;

    const companyId = getCompanyId(auth.context);
    if (!companyId) {
      return NextResponse.json({ error: "Entreprise non associée" }, { status: 400 });
    }

    const body = await readJsonBody(request);
    const parsed = companyBillingSettingsSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: parsed.error.issues[0]?.message ?? "Données invalides",
          details: parsed.error.flatten(),
        },
        { status: 400 }
      );
    }

    try {
      const settings = await updateCompanyBillingSettings(companyId, parsed.data);
      return NextResponse.json({ data: settings, success: true });
    } catch (error) {
      if (error instanceof Error && error.message === "COMPANY_NOT_FOUND") {
        return NextResponse.json({ error: "Entreprise introuvable" }, { status: 404 });
      }
      if (error instanceof Error && error.message === "SETTINGS_CONFLICT") {
        return NextResponse.json({ error: "Les réglages ont changé pendant l'enregistrement. Rechargez puis réessayez." }, { status: 409 });
      }
      throw error;
    }
  });
}
