import { prisma } from "@/services/prisma/client";
import { createClientOrder } from "@/domains/order/order.service";
import { assertDeliveryCategoryEnabled } from "@/domains/company/company-settings.service";
import type { CreateClientOrderInput } from "@/lib/validations/order";
import { createAnthropicOrderIntakeProvider } from "./anthropic-provider";
import { matchCustomerBySender } from "./order-intake.customer";
import { buildOrderIntakeDraft, type OrderIntakeDraft } from "./order-intake.draft";
import { OrderIntakeProviderError, type OrderIntakeModelProvider, type OrderIntakeProviderErrorCode } from "./order-intake.provider";
import { orderIntakeExtractionSchema, orderIntakeRequestSchema } from "./order-intake.schema";
import { ORDER_INTAKE_API_KEY_ENV, getOrderIntakeSettings, isOrderIntakeConfigured } from "./order-intake.settings";
import { completeOrderIntakeCall, reserveOrderIntakeCall } from "./order-intake.usage";

type OrderIntakeDb = Pick<typeof prisma, "company" | "user" | "orderIntakeUsage" | "$transaction">;

export type AnalyzeOrderMessageResult =
  | { status: "ok"; draft: OrderIntakeDraft }
  | { status: "disabled" }
  | { status: "not_configured" }
  | { status: "invalid"; message: string }
  | { status: "rate_limited"; retryAfterSeconds: number }
  | { status: "provider_error"; reason: OrderIntakeProviderErrorCode }
  | { status: "invalid_output" };

/**
 * Analyse un message collé et rend un brouillon. Rien n'est créé ici : la commande ne naît
 * qu'après relecture et clic humain (createOrderFromIntake).
 */
export async function analyzeOrderMessage(
  input: { companyId: string; text: unknown; sender?: unknown },
  deps: {
    db?: OrderIntakeDb;
    env?: Record<string, string | undefined>;
    now?: Date;
    provider?: OrderIntakeModelProvider;
  } = {}
): Promise<AnalyzeOrderMessageResult> {
  const db = deps.db ?? prisma;
  const env = deps.env ?? process.env;
  const now = deps.now ?? new Date();

  const settings = await getOrderIntakeSettings(input.companyId, db);
  if (!settings.enabled) return { status: "disabled" };
  if (!isOrderIntakeConfigured(env)) return { status: "not_configured" };

  const parsed = orderIntakeRequestSchema.safeParse({ text: input.text, sender: input.sender ?? undefined });
  if (!parsed.success) return { status: "invalid", message: parsed.error.issues[0]?.message ?? "Message invalide." };
  const { text, sender } = parsed.data;

  const provider = deps.provider
    ?? createAnthropicOrderIntakeProvider({ apiKey: (env[ORDER_INTAKE_API_KEY_ENV] ?? "").trim() });
  const reservation = await reserveOrderIntakeCall(input.companyId, provider.model, now, db);
  if (reservation.status === "rate_limited") return reservation;

  let result;
  try {
    result = await provider.extract({ text, sender, now });
  } catch (error) {
    const known = error instanceof OrderIntakeProviderError ? error : null;
    await completeOrderIntakeCall(reservation.id, { status: "FAILED", ...(known?.usage ?? { inputTokens: 0, outputTokens: 0 }) }, db);
    return { status: "provider_error", reason: known?.code ?? "upstream" };
  }

  const extraction = orderIntakeExtractionSchema.safeParse(result.output);
  if (!extraction.success) {
    await completeOrderIntakeCall(reservation.id, { status: "FAILED", ...result.usage }, db);
    return { status: "invalid_output" };
  }
  await completeOrderIntakeCall(reservation.id, { status: "SUCCEEDED", ...result.usage }, db);

  const draft = buildOrderIntakeDraft(extraction.data, text, now);
  draft.customerMatch = await matchCustomerBySender(input.companyId, sender, db);
  if (!draft.customerMatch) draft.missingFields.push("customer");
  return { status: "ok", draft };
}

export type CreateOrderFromIntakeResult =
  | { status: "created"; order: { id: string; reference?: string } }
  | { status: "disabled" }
  | { status: "invalid" }
  | { status: "customer_not_found" }
  | { status: "customer_inactive" }
  | { status: "category_disabled" }
  | { status: "conflict" };

type CreateOrder = typeof createClientOrder;

/**
 * Crée la commande validée par un humain, pour le compte d'un client de l'entreprise.
 * Réutilise createClientOrder sans le modifier : géocodage serveur, contrôles SaaS,
 * idempotence par clé (un double clic rend la même commande) et source ADMIN.
 */
export async function createOrderFromIntake(
  input: { companyId: string; customerId: string; order: CreateClientOrderInput; idempotencyKey: string },
  deps: {
    db?: Pick<typeof prisma, "company" | "user">;
    createOrder?: CreateOrder;
    assertCategory?: typeof assertDeliveryCategoryEnabled;
  } = {}
): Promise<CreateOrderFromIntakeResult> {
  const db = deps.db ?? prisma;
  const createOrder = deps.createOrder ?? createClientOrder;
  const assertCategory = deps.assertCategory ?? assertDeliveryCategoryEnabled;

  const settings = await getOrderIntakeSettings(input.companyId, db);
  if (!settings.enabled) return { status: "disabled" };
  if (input.order.deliveryCategory === "SPECIAL_MISSION") return { status: "invalid" };

  // Le client vient du formulaire, mais il doit être un compte CLIENT de l'entreprise de la session.
  const customer = await db.user.findFirst({
    where: { id: input.customerId, companyId: input.companyId, role: { systemRole: "CLIENT" } },
    select: { id: true, email: true, status: true },
  });
  if (!customer) return { status: "customer_not_found" };
  if (customer.status !== "ACTIVE") return { status: "customer_inactive" };

  try {
    await assertCategory(input.companyId, input.order.deliveryCategory);
  } catch (error) {
    if (error instanceof Error && error.message === "DELIVERY_CATEGORY_DISABLED") return { status: "category_disabled" };
    throw error;
  }

  try {
    const order = await createOrder(
      customer.id,
      input.companyId,
      customer.email,
      { ...input.order, source: "ADMIN" },
      { idempotencyKey: input.idempotencyKey }
    );
    return { status: "created", order: { id: order.id, reference: (order as { reference?: string }).reference } };
  } catch (error) {
    if (error instanceof Error && error.message === "IDEMPOTENCY_KEY_REUSED") return { status: "conflict" };
    throw error;
  }
}
