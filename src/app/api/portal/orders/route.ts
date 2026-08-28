import { NextResponse } from "next/server";
import { requireClientRole } from "@/lib/api/auth-guard";
import { getClientOrders, createClientOrder } from "@/domains/order/order.service";
import { createClientOrderSchema } from "@/lib/validations/order";
import { assertDeliveryCategoryEnabled } from "@/domains/company/company-settings.service";

export async function GET(request: Request) {
  const auth = await requireClientRole();
  if ("error" in auth) return auth.error;

  const { searchParams } = new URL(request.url);
  const history = searchParams.get("history") === "true";

  const orders = await getClientOrders(auth.context.user.id, { history });

  return NextResponse.json({ data: orders, success: true });
}

export async function POST(request: Request) {
  const auth = await requireClientRole();
  if ("error" in auth) return auth.error;

  const companyId = auth.context.user.companyId;
  if (!companyId) {
    return NextResponse.json({ error: "Entreprise non associée" }, { status: 400 });
  }

  const body = await request.json();
  const parsed = createClientOrderSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Données invalides", details: parsed.error.flatten() },
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

  const order = await createClientOrder(
    auth.context.user.id,
    companyId,
    auth.context.user.email,
    parsed.data
  );

  return NextResponse.json({ data: order, success: true }, { status: 201 });
}
