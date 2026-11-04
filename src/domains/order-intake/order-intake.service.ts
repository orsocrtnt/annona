import { zodIssueMessage } from "@/lib/config-messages";
import { prisma } from "@/services/prisma/client";
import {
  createOrderForCustomer,
  type CreateOrderForCustomerDeps,
  type CreateOrderForCustomerInput,
  type CreateOrderForCustomerResult,
} from "@/domains/order/staff-order.service";
import {
  createOrderForCompanyCustomer,
  type CreateOrderForCompanyCustomerDeps,
  type CreateOrderForCompanyCustomerResult,
} from "@/domains/company-customer/company-customer.service";
import { createAnthropicOrderIntakeProvider } from "./anthropic-provider";
import { matchCustomerBySender } from "./order-intake.customer";
import { buildOrderIntakeDraft, parseSender, type OrderIntakeDraft } from "./order-intake.draft";
import { OrderIntakeProviderError, type OrderIntakeModelProvider, type OrderIntakeProviderErrorCode } from "./order-intake.provider";
import { orderIntakeExtractionSchema, orderIntakeRequestSchema } from "./order-intake.schema";
import { ORDER_INTAKE_API_KEY_ENV, getOrderIntakeSettings, isOrderIntakeConfigured } from "./order-intake.settings";
import { completeOrderIntakeCall, releaseOrderIntakeCall, reserveOrderIntakeCall } from "./order-intake.usage";

type OrderIntakeDb = Pick<typeof prisma, "company" | "user" | "companyCustomer" | "orderIntakeUsage" | "$transaction" | "$queryRaw">;

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
  if (!parsed.success) return { status: "invalid", message: zodIssueMessage(parsed.error, "Message invalide.") };
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
    // Clé refusée ou fournisseur saturé : rien n'a été généré, la place de quota est rendue.
    if (known?.code === "not_configured" || known?.code === "rate_limited") {
      await releaseOrderIntakeCall(reservation.id, db);
      return known.code === "not_configured" ? { status: "not_configured" } : { status: "provider_error", reason: known.code };
    }
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
  draft.senderEmail = parseSender(sender).email;
  if (!draft.customerMatch) draft.missingFields.push("customer");
  return { status: "ok", draft };
}

export type CreateOrderFromIntakeResult =
  | CreateOrderForCustomerResult
  | { status: "disabled" }
  | { status: "invalid" };

/**
 * Crée la commande validée par un humain depuis un message : même création que le formulaire de
 * l'équipe, soumise à l'activation de la fonction et sans mission spéciale (brouillon inadapté).
 */
export async function createOrderFromIntake(
  input: CreateOrderForCustomerInput,
  deps: CreateOrderForCustomerDeps = {}
): Promise<CreateOrderFromIntakeResult> {
  const settings = await getOrderIntakeSettings(input.companyId, deps.db ?? prisma);
  if (!settings.enabled) return { status: "disabled" };
  if (input.order.deliveryCategory === "SPECIAL_MISSION") return { status: "invalid" };
  return createOrderForCustomer(input, deps);
}

export type CreateOrderFromIntakeForCardResult =
  | CreateOrderForCompanyCustomerResult
  | { status: "disabled" }
  | { status: "invalid" };

/**
 * MAIL-PONT, étape 4 : même création que `createOrderFromIntake`, pour une fiche client sans accès
 * (existante, ou créée dans la transaction de la commande).
 */
export async function createOrderFromIntakeForCard(
  input: Parameters<typeof createOrderForCompanyCustomer>[0],
  deps: CreateOrderForCompanyCustomerDeps = {}
): Promise<CreateOrderFromIntakeForCardResult> {
  const settings = await getOrderIntakeSettings(input.companyId, deps.db ?? prisma);
  if (!settings.enabled) return { status: "disabled" };
  if (input.order.deliveryCategory === "SPECIAL_MISSION") return { status: "invalid" };
  return createOrderForCompanyCustomer(input, deps);
}
