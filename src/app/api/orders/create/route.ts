import { getCompanyId, requireRole, requireStaffRole } from "@/lib/api/auth-guard";
import { createOrderForCustomer } from "@/domains/order/staff-order.service";
import { customerOrderResponse, parseCustomerOrderRequest } from "../customer-order-http";
import { intakeError, withIntakeErrors } from "../intake/intake-http";

/** Commande saisie par l'équipe avec le formulaire, pour le compte d'un client de l'entreprise (ADMIN-COMMANDE). */
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
    const result = await createOrderForCustomer({
      companyId,
      customerId: parsed.customerId,
      order: parsed.order,
      idempotencyKey: parsed.idempotencyKey,
    });
    return customerOrderResponse(
      result,
      "Une commande a déjà été créée par cette tentative (peut-être pour un autre client). Vérifiez la liste des commandes, puis rechargez la page pour en créer une autre."
    );
  });
}
