import { prisma } from "@/services/prisma/client";
import { createClientOrder } from "@/domains/order/order.service";
import { assertDeliveryCategoryEnabled } from "@/domains/company/company-settings.service";
import { DELIVERY_SLOT_ERROR_MESSAGES, resolveDeliverySlot } from "@/domains/order/delivery-slot";
import { parseDeliverySlots } from "@/lib/validations/delivery-slots";
import type { CreateClientOrderInput } from "@/lib/validations/order";

export type CreateOrderForCustomerResult =
  | { status: "created"; order: { id: string; reference?: string } }
  | { status: "customer_not_found" }
  | { status: "customer_inactive" }
  | { status: "category_disabled" }
  | { status: "slot_invalid"; message: string }
  | { status: "conflict" }
  | { status: "saas_blocked" }
  | { status: "saas_read_only" };

export type CreateOrderForCustomerInput = {
  companyId: string;
  customerId: string;
  order: CreateClientOrderInput;
  idempotencyKey: string;
};

export type CreateOrderForCustomerDeps = {
  db?: Pick<typeof prisma, "company" | "user" | "order">;
  createOrder?: typeof createClientOrder;
  assertCategory?: typeof assertDeliveryCategoryEnabled;
};

/** Refus métier connus de createClientOrder / assertCanCreateOrder ; le reste remonte comme panne. */
const CREATE_ERROR_STATUSES: Record<string, "conflict" | "saas_blocked" | "saas_read_only"> = {
  IDEMPOTENCY_KEY_REUSED: "conflict",
  SAAS_ORDER_CREATION_BLOCKED: "saas_blocked",
  SAAS_ACCOUNT_READ_ONLY: "saas_read_only",
};

/**
 * Crée une commande saisie par l'équipe (formulaire ou message validé) pour un client de l'entreprise.
 * Réutilise createClientOrder sans le modifier : géocodage serveur, contrôles SaaS, dispatch,
 * idempotence par clé (un double clic rend la même commande) et source ADMIN.
 */
export async function createOrderForCustomer(
  input: CreateOrderForCustomerInput,
  deps: CreateOrderForCustomerDeps = {}
): Promise<CreateOrderForCustomerResult> {
  const db = deps.db ?? prisma;
  const createOrder = deps.createOrder ?? createClientOrder;
  const assertCategory = deps.assertCategory ?? assertDeliveryCategoryEnabled;

  // Le client vient du formulaire, mais il doit être un compte CLIENT de l'entreprise de la session.
  const customer = await db.user.findFirst({
    where: { id: input.customerId, companyId: input.companyId, role: { systemRole: "CLIENT" } },
    select: { id: true, email: true, status: true },
  });
  if (!customer) return { status: "customer_not_found" };
  if (customer.status !== "ACTIVE") return { status: "customer_inactive" };

  // L'unicité existante porte sur (client, clé) : une clé déjà utilisée dans l'entreprise pour un
  // autre client signale un premier essai abouti (réponse perdue) suivi d'un changement de client.
  const previous = await db.order.findFirst({
    where: { companyId: input.companyId, idempotencyKey: input.idempotencyKey },
    select: { customerId: true },
  });
  if (previous && previous.customerId !== customer.id) return { status: "conflict" };

  const prepared = await prepareStaffOrderInput(input.companyId, input.order, { db, assertCategory });
  if (!prepared.ok) return prepared.result;

  try {
    const order = await createOrder(
      customer.id,
      input.companyId,
      customer.email,
      prepared.order,
      {
        idempotencyKey: input.idempotencyKey,
        // Atomique : le verrou (entreprise, clé) est tenu jusqu'à la fin de la transaction de création,
        // donc deux requêtes simultanées pour deux clients ne peuvent pas créer deux commandes.
        beforeCreate: async (tx) => {
          await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${input.companyId}::text || ':' || ${input.idempotencyKey}::text, 0))`;
          const winner = await tx.order.findFirst({
            where: { companyId: input.companyId, idempotencyKey: input.idempotencyKey },
            select: { customerId: true },
          });
          if (winner && winner.customerId !== customer.id) throw new Error("IDEMPOTENCY_KEY_REUSED");
        },
      }
    );
    return { status: "created", order: { id: order.id, reference: (order as { reference?: string }).reference } };
  } catch (error) {
    return staffOrderRefusal(error);
  }
}

/**
 * Contrôles communs aux commandes saisies par l'équipe (compte client ou fiche sans accès) :
 * type de livraison activé, créneau valide ; renvoie la commande prête, source ADMIN.
 */
export async function prepareStaffOrderInput(
  companyId: string,
  order: CreateClientOrderInput,
  deps: { db: Pick<typeof prisma, "company">; assertCategory: typeof assertDeliveryCategoryEnabled }
): Promise<{ ok: true; order: CreateClientOrderInput & { saveAddress: false; source: "ADMIN" } } | { ok: false; result: CreateOrderForCustomerResult }> {
  try {
    await deps.assertCategory(companyId, order.deliveryCategory);
  } catch (error) {
    if (error instanceof Error && error.message === "DELIVERY_CATEGORY_DISABLED") return { ok: false, result: { status: "category_disabled" } };
    throw error;
  }

  const company = await deps.db.company.findUnique({ where: { id: companyId }, select: { settings: true } });
  const slot = resolveDeliverySlot(
    parseDeliverySlots((company?.settings as Record<string, unknown> | null)?.deliverySlots),
    order,
    new Date()
  );
  if (!slot.ok) return { ok: false, result: { status: "slot_invalid", message: DELIVERY_SLOT_ERROR_MESSAGES[slot.error] } };
  return {
    ok: true,
    order: {
      ...order,
      ...(slot.deliverySlotStart ? { requestedDeliveryDate: slot.requestedDeliveryDate, deliverySlotStart: slot.deliverySlotStart } : {}),
      // Le carnet d'adresses appartient au client : l'équipe ne l'écrit pas.
      saveAddress: false,
      source: "ADMIN",
    },
  };
}

/** Traduit un refus connu de la création ; toute autre erreur remonte comme panne. */
export function staffOrderRefusal(error: unknown): CreateOrderForCustomerResult {
  const known = error instanceof Error ? CREATE_ERROR_STATUSES[error.message] : undefined;
  if (known) return { status: known };
  throw error;
}
