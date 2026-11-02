import { NextResponse } from "next/server";
import { getCompanyId, requireRole, requireStaffRole } from "@/lib/api/auth-guard";
import { withApiHandler } from "@/lib/api/route-handler";
import {
  getCompanyDeliveryOptions,
  getCompanyDeliverySlots,
  getEnabledDeliveryCategories,
} from "@/domains/company/company-settings.service";

/** Types de livraison et créneaux du formulaire de commande de l'équipe : mêmes droits que sa création. */
export async function GET() {
  return withApiHandler(async () => {
    const auth = await requireStaffRole("orders:create");
    if ("error" in auth) return auth.error;
    const denied = requireRole(auth.context, ["COMPANY_ADMIN", "MINI_ADMIN", "DISPATCHER"]);
    if (denied) return denied;
    const companyId = getCompanyId(auth.context);
    if (!companyId) return NextResponse.json({ error: "Entreprise non associée" }, { status: 400 });

    const [options, deliverySlots] = await Promise.all([getCompanyDeliveryOptions(companyId), getCompanyDeliverySlots(companyId)]);
    const enabled = getEnabledDeliveryCategories(options);
    return NextResponse.json({ data: { options, enabled, deliverySlots }, success: true });
  });
}
