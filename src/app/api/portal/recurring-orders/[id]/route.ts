import { NextResponse } from "next/server";
import { requireClientRole } from "@/lib/api/auth-guard";
import { updateClientRecurringOrder } from "@/domains/client-portal/recurring-order.service";
import { updateRecurringOrderSchema } from "@/lib/validations/order";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireClientRole();
  if ("error" in auth) return auth.error;

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const parsed = updateRecurringOrderSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Données invalides", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const updated = await updateClientRecurringOrder(
    auth.context.user.id,
    id,
    parsed.data
  );

  if (!updated) {
    return NextResponse.json({ error: "Commande récurrente introuvable" }, { status: 404 });
  }

  return NextResponse.json({ data: updated, success: true });
}
