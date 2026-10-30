import { CONFIG_MESSAGES } from "@/lib/config-messages";
import { getCompanyId, requireRole, requireStaffRole } from "@/lib/api/auth-guard";
import { createClientOrderSchema } from "@/lib/validations/order";
import { createOrderFromIntake } from "@/domains/order-intake/order-intake.service";
import { intakeError, intakeJson, withIntakeErrors } from "../intake-http";

const IDEMPOTENCY_KEY = /^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$/;

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

    const idempotencyKey = request.headers.get("idempotency-key")?.trim();
    if (!idempotencyKey || !IDEMPOTENCY_KEY.test(idempotencyKey)) {
      return intakeError("INVALID_KEY", "Clé de création manquante ou invalide", 400);
    }

    const body = (await request.json().catch(() => null)) as { customerId?: unknown; order?: unknown } | null;
    const customerId = typeof body?.customerId === "string" ? body.customerId.trim() : "";
    if (!customerId || customerId.length > 64) return intakeError("CUSTOMER_REQUIRED", "Choisissez le client de la commande.", 400);
    const parsed = createClientOrderSchema.safeParse(body?.order);
    if (!parsed.success) {
      return intakeError("INVALID_ORDER", "Complétez les champs obligatoires avant de créer la commande.", 400);
    }

    // Entreprise de la session ; la source ADMIN est fixée par le domaine, jamais par le corps.
    const result = await createOrderFromIntake({ companyId, customerId, order: parsed.data, idempotencyKey });
    switch (result.status) {
      case "created":
        return intakeJson({ success: true, data: result.order }, 201);
      case "disabled":
        return intakeError("INTAKE_DISABLED", CONFIG_MESSAGES.INTAKE_DISABLED, 403);
      case "invalid":
        return intakeError("INVALID_ORDER", "Ce type de commande se saisit depuis le formulaire complet.", 400);
      case "customer_not_found":
        return intakeError("CUSTOMER_NOT_FOUND", "Client introuvable dans votre entreprise.", 404);
      case "customer_inactive":
        return intakeError("CUSTOMER_INACTIVE", "Ce compte client n'est pas actif.", 409);
      case "slot_invalid":
        return intakeError("SLOT_INVALID", result.message, 400);
      case "category_disabled":
        return intakeError("CATEGORY_DISABLED", "Ce type de livraison n'est pas activé pour votre entreprise.", 403);
      case "conflict":
        return intakeError(
          "IDEMPOTENCY_CONFLICT",
          "Une commande a déjà été créée par cette tentative (peut-être pour un autre client). Vérifiez la liste des commandes avant de relancer l'analyse.",
          409
        );
      case "saas_blocked":
        return intakeError("SAAS_ORDER_BLOCKED", "Votre abonnement ne permet plus de créer de commandes. Consultez « Mon abonnement ».", 403);
      case "saas_read_only":
        return intakeError("SAAS_READ_ONLY", "Votre compte est en lecture seule : aucune nouvelle commande n'est possible.", 403);
    }
  });
}
