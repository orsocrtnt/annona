import { NextResponse } from "next/server";
import { requireClientRole } from "@/lib/api/auth-guard";
import {
  getCompanyDeliveryOptions,
  getCompanyDeliverySlots,
  getEnabledDeliveryCategories,
} from "@/domains/company/company-settings.service";

export async function GET() {
  const auth = await requireClientRole();
  if ("error" in auth) return auth.error;

  const companyId = auth.context.user.companyId;
  if (!companyId) {
    return NextResponse.json({ error: "Entreprise non associée" }, { status: 400 });
  }

  const [options, deliverySlots] = await Promise.all([getCompanyDeliveryOptions(companyId), getCompanyDeliverySlots(companyId)]);
  const enabled = getEnabledDeliveryCategories(options);

  return NextResponse.json({
    data: { options, enabled, deliverySlots },
    success: true,
  });
}
