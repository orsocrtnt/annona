import { getCompanyId, requireRole, requireStaffRole } from "@/lib/api/auth-guard";
import { listCompanyCustomers } from "@/domains/company-customer/company-customer.service";
import { intakeError, intakeJson, withIntakeErrors } from "../intake-http";

/** MAIL-PONT, étape 4 : fiches clients sans accès de l'entreprise de la session, pour le brouillon. */
export async function GET() {
  return withIntakeErrors(async () => {
    const auth = await requireStaffRole("orders:create");
    if ("error" in auth) return auth.error;
    const denied = requireRole(auth.context, ["COMPANY_ADMIN", "MINI_ADMIN", "DISPATCHER"]);
    if (denied) return denied;
    const companyId = getCompanyId(auth.context);
    if (!companyId) return intakeError("NO_COMPANY", "Entreprise non associée", 400);
    return intakeJson({ success: true, data: await listCompanyCustomers(companyId) });
  });
}
