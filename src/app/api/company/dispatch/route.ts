import { CONFIG_MESSAGES, firstFieldMessage } from "@/lib/config-messages";
import { NextResponse } from "next/server";
import { getCompanyId, requireRole, requireStaffRole } from "@/lib/api/auth-guard";
import {
  getCompanyDispatchSettings,
  updateCompanyDispatchSettings,
} from "@/domains/company/dispatch-settings.service";
import { companyDispatchSettingsSchema } from "@/lib/validations/dispatch-settings";

const DISPATCH_FIELD_LABELS = {
  strategy: "Stratégie",
  maxActiveDeliveriesPerDriver: "Livraisons actives maximum par livreur",
  gpsPositionMaxAgeMinutes: "Ancienneté maximale de la position GPS",
  gpsMaxDistanceKm: "Distance maximale au retrait",
  driverRules: "Règles par livreur",
  autoAssignCategories: "Catégories attribuées automatiquement",
};

export async function GET() {
  const auth = await requireStaffRole("settings:read");
  if ("error" in auth) return auth.error;
  const denied = requireRole(auth.context, ["COMPANY_ADMIN", "MINI_ADMIN"]);
  if (denied) return denied;

  const companyId = getCompanyId(auth.context);
  if (!companyId) {
    return NextResponse.json({ error: "Entreprise non associée" }, { status: 400 });
  }

  const settings = await getCompanyDispatchSettings(companyId);
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

  const body = await request.json();
  const parsed = companyDispatchSettingsSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: firstFieldMessage(parsed.error.flatten(), DISPATCH_FIELD_LABELS, parsed.error.issues[0]?.message ?? "Réglages de dispatch invalides : vérifiez les valeurs saisies."),
        details: parsed.error.flatten(),
      },
      { status: 400 }
    );
  }

  try {
    const settings = await updateCompanyDispatchSettings(companyId, parsed.data);
    return NextResponse.json({ data: settings, success: true });
  } catch (error) {
    if (error instanceof Error && error.message === "COMPANY_NOT_FOUND") {
      return NextResponse.json({ error: "Entreprise introuvable" }, { status: 404 });
    }
    if (error instanceof Error && error.message === "SAAS_FEATURE_NOT_AVAILABLE") {
      return NextResponse.json(
        { error: CONFIG_MESSAGES.DISPATCH_FEATURE_NOT_IN_PLAN },
        { status: 403 }
      );
    }
    throw error;
  }
}
