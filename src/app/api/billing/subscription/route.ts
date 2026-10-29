import { billingFailureMessage } from "@/lib/config-messages";
import { NextResponse } from "next/server";
import { getCompanyId, requireRole, requireStaffRole } from "@/lib/api/auth-guard";
import { getSubscriptionView } from "@/domains/billing/subscription-view.service";

export async function GET() {
  const auth = await requireStaffRole("settings:read");
  if ("error" in auth) return auth.error;
  const roleError = requireRole(auth.context, ["COMPANY_ADMIN"]);
  if (roleError) return roleError;
  const companyId = getCompanyId(auth.context);
  if (!companyId) {
    return NextResponse.json({ error: "Entreprise absente" }, { status: 403 });
  }
  try {
    const subscription = await getSubscriptionView(companyId);
    return NextResponse.json({ data: subscription }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return NextResponse.json(
      { error: billingFailureMessage(error, "Chargement de l’abonnement impossible : réessayez dans un instant ; si cela persiste, contactez le support.") },
      { status: 503, headers: { "Cache-Control": "no-store" } }
    );
  }
}
