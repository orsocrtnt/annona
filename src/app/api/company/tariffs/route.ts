import { zodIssueMessage } from "@/lib/config-messages";
import { NextResponse } from "next/server";
import { getCompanyId, requireRole, requireStaffRole } from "@/lib/api/auth-guard";
import { requireDispatchSettingsReader } from "@/lib/api/dispatch-settings-read-guard";
import {
  getCompanyTariffSettings,
  updateCompanyTariffSettings,
} from "@/domains/company/tariff-settings.service";
import { companyTariffSettingsSchema } from "@/lib/validations/tariff-settings";

export async function GET() {
  const auth = await requireDispatchSettingsReader();
  if ("error" in auth) return auth.error;

  const companyId = getCompanyId(auth.context);
  if (!companyId) {
    return NextResponse.json({ error: "Entreprise non associée" }, { status: 400 });
  }

  const settings = await getCompanyTariffSettings(companyId);
  return NextResponse.json({ data: settings, success: true });
}

export async function PATCH(request: Request) {
  const auth = await requireStaffRole("settings:update");
  if ("error" in auth) return auth.error;
  const denied = requireRole(auth.context, ["COMPANY_ADMIN", "MINI_ADMIN"]);
  if (denied) return denied;

  const companyId = getCompanyId(auth.context);
  if (!companyId) {
    return NextResponse.json({ error: "Entreprise non associée" }, { status: 400 });
  }

  const body = await request.json().catch(() => null);
  const parsed = companyTariffSettingsSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: zodIssueMessage(parsed.error, "Données invalides") },
      { status: 400 }
    );
  }

  try {
    const settings = await updateCompanyTariffSettings(companyId, parsed.data);
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
}
