import { getCompanyId, requireRole, requireStaffRole } from "@/lib/api/auth-guard";
import { listInboundEmails } from "@/domains/order-intake/inbound-email.service";
import { intakeError, intakeJson, withIntakeErrors } from "../intake-http";

/** E-mails de commande à traiter : mêmes droits que la création d'une commande depuis un message. */
export async function GET() {
  return withIntakeErrors(async () => {
    const auth = await requireStaffRole("orders:create");
    if ("error" in auth) return auth.error;
    const denied = requireRole(auth.context, ["COMPANY_ADMIN", "MINI_ADMIN", "DISPATCHER"]);
    if (denied) return denied;
    const companyId = getCompanyId(auth.context);
    if (!companyId) return intakeError("NO_COMPANY", "Entreprise non associée", 400);
    return intakeJson({ success: true, data: await listInboundEmails(companyId) });
  });
}
