import { NextResponse } from "next/server";
import { requireClientRole } from "@/lib/api/auth-guard";
import {
  getCompanyDeliveryOptions,
  getEnabledDeliveryCategories,
} from "@/domains/company/company-settings.service";

export async function GET() {
  const auth = await requireClientRole();
  if ("error" in auth) return auth.error;

  const companyId = auth.context.user.companyId;
  if (!companyId) {
    return NextResponse.json({ error: "Entreprise non associée" }, { status: 400 });
  }

  const options = await getCompanyDeliveryOptions(companyId);
  const enabled = getEnabledDeliveryCategories(options);

  return NextResponse.json({
    data: { options, enabled },
    success: true,
  });
}
