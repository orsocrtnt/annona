import type { NextResponse } from "next/server";
import { zodIssueMessage } from "@/lib/config-messages";
import { createClientOrderSchema, type CreateClientOrderInput } from "@/lib/validations/order";
import { newCompanyCustomerSchema } from "@/domains/company-customer/company-customer.schema";
import type {
  CompanyCustomerChoice,
  CreateOrderForCompanyCustomerResult,
} from "@/domains/company-customer/company-customer.service";
import { intakeError, intakeJson } from "./intake/intake-http";

const IDEMPOTENCY_KEY = /^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$/;

type ParsedCustomerOrderRequest =
  | { ok: true; customerId: string; card: CompanyCustomerChoice | null; order: CreateClientOrderInput; idempotencyKey: string }
  | { ok: false; response: NextResponse };

/**
 * Lit une commande saisie par l'équipe : client, commande et clé de double clic. Avec
 * `allowCompanyCustomer` (commande reçue, MAIL-PONT étape 4), le client peut être une fiche sans
 * accès (`companyCustomerId`) ou une nouvelle fiche (`newCustomer`) ; `customerId` est alors vide.
 */
export async function parseCustomerOrderRequest(
  request: Request,
  options: { allowCompanyCustomer?: boolean } = {}
): Promise<ParsedCustomerOrderRequest> {
  const idempotencyKey = request.headers.get("idempotency-key")?.trim();
  if (!idempotencyKey || !IDEMPOTENCY_KEY.test(idempotencyKey)) {
    return { ok: false, response: intakeError("INVALID_KEY", "Clé de création manquante ou invalide", 400) };
  }

  const body = (await request.json().catch(() => null)) as
    | { customerId?: unknown; companyCustomerId?: unknown; newCustomer?: unknown; order?: unknown }
    | null;
  let card: CompanyCustomerChoice | null = null;
  if (options.allowCompanyCustomer && typeof body?.companyCustomerId === "string" && body.companyCustomerId.trim()) {
    const id = body.companyCustomerId.trim();
    if (id.length > 64) return { ok: false, response: intakeError("CUSTOMER_REQUIRED", "Choisissez le client de la commande.", 400) };
    card = { kind: "existing", id };
  } else if (options.allowCompanyCustomer && body?.newCustomer !== undefined) {
    const parsedCustomer = newCompanyCustomerSchema.safeParse(body.newCustomer);
    if (!parsedCustomer.success) {
      return { ok: false, response: intakeError("INVALID_CUSTOMER", zodIssueMessage(parsedCustomer.error, "Fiche client incomplète."), 400) };
    }
    card = { kind: "new", customer: parsedCustomer.data };
  }
  const customerId = card ? "" : typeof body?.customerId === "string" ? body.customerId.trim() : "";
  if (!card && (!customerId || customerId.length > 64)) {
    return { ok: false, response: intakeError("CUSTOMER_REQUIRED", "Choisissez le client de la commande.", 400) };
  }
  const parsed = createClientOrderSchema.safeParse(body?.order);
  if (!parsed.success) {
    return { ok: false, response: intakeError("INVALID_ORDER", "Complétez les champs obligatoires avant de créer la commande.", 400) };
  }
  return { ok: true, customerId, card, order: parsed.data, idempotencyKey };
}

/** Traduit le résultat du domaine en réponse : aucune erreur 500 pour un refus métier. */
export function customerOrderResponse(result: CreateOrderForCompanyCustomerResult, conflictMessage: string) {
  switch (result.status) {
    case "created":
      return intakeJson({ success: true, data: result.order }, 201);
    case "customer_not_found":
      return intakeError("CUSTOMER_NOT_FOUND", "Client introuvable dans votre entreprise.", 404);
    case "customer_has_account":
      return intakeError("CUSTOMER_HAS_ACCOUNT", "Ce client a déjà un compte dans votre entreprise : choisissez-le dans la liste.", 409);
    case "customer_inactive":
      return intakeError("CUSTOMER_INACTIVE", "Ce compte client n'est pas actif.", 409);
    case "slot_invalid":
      return intakeError("SLOT_INVALID", result.message, 400);
    case "category_disabled":
      return intakeError("CATEGORY_DISABLED", "Ce type de livraison n'est pas activé pour votre entreprise.", 403);
    case "conflict":
      return intakeError("IDEMPOTENCY_CONFLICT", conflictMessage, 409);
    case "saas_blocked":
      return intakeError("SAAS_ORDER_BLOCKED", "Votre abonnement ne permet plus de créer de commandes. Consultez « Mon abonnement ».", 403);
    case "saas_read_only":
      return intakeError("SAAS_READ_ONLY", "Votre compte est en lecture seule : aucune nouvelle commande n'est possible.", 403);
  }
}
