import { NextResponse } from "next/server";
import { requireClientRole } from "@/lib/api/auth-guard";
import { listClientOrderHistory, createClientOrder } from "@/domains/order/order.service";
import { createClientOrderSchema } from "@/lib/validations/order";
import { parseOrderHistoryQuery } from "@/lib/validations/order-history";
import { assertDeliveryCategoryEnabled } from "@/domains/company/company-settings.service";

export async function GET(request: Request) {
  const auth = await requireClientRole();
  if ("error" in auth) return auth.error;
  const companyId = auth.context.user.companyId;
  if (!companyId) {
    return NextResponse.json({ error: "Entreprise non associée" }, { status: 403 });
  }

  const parsed = parseOrderHistoryQuery(request.url);
  if (!parsed.success) {
    return NextResponse.json({ error: "Filtres invalides", details: parsed.error.flatten() }, { status: 400 });
  }

  const result = await listClientOrderHistory(auth.context.user.id, companyId, parsed.data);
  return NextResponse.json({ data: result, success: true });
}

export async function POST(request: Request) {
  const auth = await requireClientRole();
  if ("error" in auth) return auth.error;

  const companyId = auth.context.user.companyId;
  if (!companyId) {
    return NextResponse.json({ error: "Entreprise non associée" }, { status: 400 });
  }

  const body = await request.json().catch(() => null);
  const parsed = createClientOrderSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Données invalides", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const idempotencyKey = request.headers.get("idempotency-key")?.trim();
  if (!idempotencyKey || !/^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$/.test(idempotencyKey)) {
    return NextResponse.json(
      { error: "Clé de création manquante ou invalide" },
      { status: 400 }
    );
  }

  try {
    await assertDeliveryCategoryEnabled(companyId, parsed.data.deliveryCategory);
  } catch (error) {
    if (error instanceof Error && error.message === "DELIVERY_CATEGORY_DISABLED") {
      return NextResponse.json(
        { error: "Ce type de livraison n'est pas disponible pour votre compte" },
        { status: 403 }
      );
    }
    throw error;
  }

  let order;
  try {
    order = await createClientOrder(
      auth.context.user.id,
      companyId,
      auth.context.user.email,
      parsed.data,
      { idempotencyKey }
    );
  } catch (error) {
    if (error instanceof Error && error.message === "IDEMPOTENCY_KEY_REUSED") {
      return NextResponse.json(
        { error: "Cette tentative correspond déjà à une autre commande" },
        { status: 409 }
      );
    }
    throw error;
  }

  return NextResponse.json({ data: order, success: true }, { status: 201 });
}
