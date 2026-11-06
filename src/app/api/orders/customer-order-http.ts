import { NextResponse } from "next/server";
import { createClientOrderSchema, type CreateClientOrderInput } from "@/lib/validations/order";
import type { CreateOrderForCustomerResult } from "@/domains/order/staff-order.service";

const IDEMPOTENCY_KEY = /^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$/;

/** Réponses de la commande saisie par l'équipe : jamais de détail interne, jamais de cache. */
export function orderJson(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

export function orderError(code: string, error: string, status: number) {
  return orderJson({ success: false, code, error }, status);
}

/** Une panne (base, migration absente, réseau) rend un 503 générique plutôt qu'un 500 bavard. */
export async function withOrderErrors(handler: () => Promise<NextResponse>): Promise<NextResponse> {
  try {
    return await handler();
  } catch (error) {
    console.error("[staff-order] échec", error instanceof Error ? error.name : "unknown");
    return orderError("ORDER_UNAVAILABLE", "Service momentanément indisponible. Réessayez dans un instant.", 503);
  }
}

type ParsedCustomerOrderRequest =
  | { ok: true; customerId: string; order: CreateClientOrderInput; idempotencyKey: string }
  | { ok: false; response: NextResponse };

/** Lit une commande saisie par l'équipe : client, commande et clé de double clic. */
export async function parseCustomerOrderRequest(request: Request): Promise<ParsedCustomerOrderRequest> {
  const idempotencyKey = request.headers.get("idempotency-key")?.trim();
  if (!idempotencyKey || !IDEMPOTENCY_KEY.test(idempotencyKey)) {
    return { ok: false, response: orderError("INVALID_KEY", "Clé de création manquante ou invalide", 400) };
  }

  const body = (await request.json().catch(() => null)) as { customerId?: unknown; order?: unknown } | null;
  const customerId = typeof body?.customerId === "string" ? body.customerId.trim() : "";
  if (!customerId || customerId.length > 64) {
    return { ok: false, response: orderError("CUSTOMER_REQUIRED", "Choisissez le client de la commande.", 400) };
  }
  const parsed = createClientOrderSchema.safeParse(body?.order);
  if (!parsed.success) {
    return { ok: false, response: orderError("INVALID_ORDER", "Complétez les champs obligatoires avant de créer la commande.", 400) };
  }
  return { ok: true, customerId, order: parsed.data, idempotencyKey };
}

/** Traduit le résultat du domaine en réponse : aucune erreur 500 pour un refus métier. */
export function customerOrderResponse(result: CreateOrderForCustomerResult, conflictMessage: string) {
  switch (result.status) {
    case "created":
      return orderJson({ success: true, data: result.order }, 201);
    case "customer_not_found":
      return orderError("CUSTOMER_NOT_FOUND", "Client introuvable dans votre entreprise.", 404);
    case "customer_inactive":
      return orderError("CUSTOMER_INACTIVE", "Ce compte client n'est pas actif.", 409);
    case "slot_invalid":
      return orderError("SLOT_INVALID", result.message, 400);
    case "category_disabled":
      return orderError("CATEGORY_DISABLED", "Ce type de livraison n'est pas activé pour votre entreprise.", 403);
    case "conflict":
      return orderError("IDEMPOTENCY_CONFLICT", conflictMessage, 409);
  }
}
