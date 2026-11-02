import { CONFIG_MESSAGES } from "@/lib/config-messages";
import { getCompanyId, requireRole, requireStaffRole } from "@/lib/api/auth-guard";
import { createOrderFromIntake } from "@/domains/order-intake/order-intake.service";
import { customerOrderResponse, parseCustomerOrderRequest } from "../../customer-order-http";
import { intakeError, withIntakeErrors } from "../intake-http";

/**
 * Crée la commande relue et validée par un humain, pour le compte d'un client de l'entreprise.
 * Même clé d'idempotence que le portail : un double clic rend une seule commande.
 */
export async function POST(request: Request) {
  return withIntakeErrors(async () => {
    const auth = await requireStaffRole("orders:create");
    if ("error" in auth) return auth.error;
    const denied = requireRole(auth.context, ["COMPANY_ADMIN", "MINI_ADMIN", "DISPATCHER"]);
    if (denied) return denied;
    const companyId = getCompanyId(auth.context);
    if (!companyId) return intakeError("NO_COMPANY", "Entreprise non associée", 400);

    const parsed = await parseCustomerOrderRequest(request);
    if (!parsed.ok) return parsed.response;

    // Entreprise de la session ; la source ADMIN est fixée par le domaine, jamais par le corps.
    const result = await createOrderFromIntake({
      companyId,
      customerId: parsed.customerId,
      order: parsed.order,
      idempotencyKey: parsed.idempotencyKey,
    });
    switch (result.status) {
      case "disabled":
        return intakeError("INTAKE_DISABLED", CONFIG_MESSAGES.INTAKE_DISABLED, 403);
      case "invalid":
        return intakeError("INVALID_ORDER", "Ce type de commande se saisit depuis le formulaire complet.", 400);
      default:
        return customerOrderResponse(
          result,
          "Une commande a déjà été créée par cette tentative (peut-être pour un autre client). Vérifiez la liste des commandes avant de relancer l'analyse."
        );
    }
  });
}
