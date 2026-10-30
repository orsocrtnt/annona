import { zodIssueMessage } from "@/lib/config-messages";
import { NextResponse } from "next/server";
import { getCompanyId, requireRole, requireStaffRole } from "@/lib/api/auth-guard";
import { getCompanyDeliverySlots, updateCompanyDeliverySlots } from "@/domains/company/company-settings.service";
import { companyDeliverySlotsSchema } from "@/lib/validations/delivery-slots";

export async function GET() {
  const auth = await requireStaffRole("settings:read");
  if ("error" in auth) return auth.error;
  const denied = requireRole(auth.context, ["COMPANY_ADMIN", "MINI_ADMIN"]);
  if (denied) return denied;

  const companyId = getCompanyId(auth.context);
  if (!companyId) {
    return NextResponse.json({ error: "Entreprise non associée" }, { status: 400 });
  }

  return NextResponse.json({ data: await getCompanyDeliverySlots(companyId), success: true });
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

  const parsed = companyDeliverySlotsSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: zodIssueMessage(parsed.error, "Données invalides") }, { status: 400 });
  }

  try {
    return NextResponse.json({ data: await updateCompanyDeliverySlots(companyId, parsed.data), success: true });
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
