import { NextResponse } from "next/server";
import { getCompanyId, requireStaffRole } from "@/lib/api/auth-guard";
import {
  getCompanyTariffSettings,
  updateCompanyTariffSettings,
} from "@/domains/company/tariff-settings.service";
import { companyTariffSettingsSchema } from "@/lib/validations/tariff-settings";

export async function GET() {
  const auth = await requireStaffRole("settings:read");
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

  const companyId = getCompanyId(auth.context);
  if (!companyId) {
    return NextResponse.json({ error: "Entreprise non associée" }, { status: 400 });
  }

  const body = await request.json();
  const parsed = companyTariffSettingsSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Données invalides", details: parsed.error.flatten() },
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
    throw error;
  }
}
