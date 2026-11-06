import { NextResponse } from "next/server";
import { deleteRecurringOrder, updateRecurringOrder } from "@/domains/order/recurring-order.service";
import { merchantRef } from "@/lib/api/merchant-ref";
import { readJsonBody, withApiHandler } from "@/lib/api/route-handler";
import { requireMerchantActor } from "@/lib/api/tenant-auth";
import { updateRecurringOrderSchema } from "@/lib/validations/order";

/** CLI-09 : modifier, suspendre ou réactiver une commande récurrente du client. */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return withApiHandler(async () => {
    const guard = await requireMerchantActor();
    if ("error" in guard) return guard.error;
    const { id } = await params;
    const input = updateRecurringOrderSchema.parse(await readJsonBody(request));
    return NextResponse.json({ data: await updateRecurringOrder(merchantRef(guard.actor), id, input), success: true });
  });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  return withApiHandler(async () => {
    const guard = await requireMerchantActor();
    if ("error" in guard) return guard.error;
    const { id } = await params;
    await deleteRecurringOrder(merchantRef(guard.actor), id);
    return NextResponse.json({ success: true });
  });
}
