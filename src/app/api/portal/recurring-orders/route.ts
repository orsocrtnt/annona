import { NextResponse } from "next/server";
import { requireClientRole } from "@/lib/api/auth-guard";
import {
  getClientRecurringOrders,
  createClientRecurringOrder,
} from "@/domains/client-portal/recurring-order.service";
import { createRecurringOrderSchema } from "@/lib/validations/order";

export async function GET() {
  const auth = await requireClientRole();
  if ("error" in auth) return auth.error;

  const orders = await getClientRecurringOrders(auth.context.user.id);
  return NextResponse.json({ data: orders, success: true });
}

export async function POST(request: Request) {
  const auth = await requireClientRole();
  if ("error" in auth) return auth.error;

  const companyId = auth.context.user.companyId;
  if (!companyId) {
    return NextResponse.json({ error: "Entreprise non associée" }, { status: 400 });
  }

  const body = await request.json().catch(() => null);
  const parsed = createRecurringOrderSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Données invalides", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  try {
    const recurring = await createClientRecurringOrder(
      auth.context.user.id,
      companyId,
      auth.context.user.email,
      parsed.data
    );

    return NextResponse.json({ data: recurring, success: true }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === "RECURRING_SPECIAL_MISSION_UNSUPPORTED") {
      return NextResponse.json(
        { error: "Les missions spéciales ne peuvent pas être récurrentes." },
        { status: 400 }
      );
    }
    if (error instanceof Error && error.message === "DELIVERY_CATEGORY_DISABLED") {
      return NextResponse.json(
        { error: "Ce type de livraison n'est pas disponible" },
        { status: 400 }
      );
    }
    throw error;
  }
}
