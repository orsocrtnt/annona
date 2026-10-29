import { NextResponse } from "next/server";
import { getCompanyId, requireRole, requireStaffRole } from "@/lib/api/auth-guard";
import {
  getCompanyDeliveryOptions,
  updateCompanyDeliveryOptions,
} from "@/domains/company/company-settings.service";
import { companyDeliveryOptionsSchema } from "@/lib/validations/company-settings";

export async function GET() {
  const auth = await requireStaffRole("settings:read");
  if ("error" in auth) return auth.error;
  const denied = requireRole(auth.context, ["COMPANY_ADMIN", "MINI_ADMIN"]);
  if (denied) return denied;

  const companyId = getCompanyId(auth.context);
  if (!companyId) {
    return NextResponse.json({ error: "Entreprise non associée" }, { status: 400 });
  }

  const options = await getCompanyDeliveryOptions(companyId);
  return NextResponse.json({ data: options, success: true });
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
  const parsed = companyDeliveryOptionsSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Données invalides", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  try {
    const options = await updateCompanyDeliveryOptions(companyId, parsed.data);
    return NextResponse.json({ data: options, success: true });
  } catch (error) {
    if (error instanceof Error && error.message === "COMPANY_NOT_FOUND") {
      return NextResponse.json({ error: "Entreprise introuvable" }, { status: 404 });
    }
    throw error;
  }
}
