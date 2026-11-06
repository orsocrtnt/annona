import { NextResponse } from "next/server";
import { createRecurringOrder, listRecurringOrders } from "@/domains/order/recurring-order.service";
import { merchantRef } from "@/lib/api/merchant-ref";
import { readJsonBody, withApiHandler } from "@/lib/api/route-handler";
import { requireMerchantActor } from "@/lib/api/tenant-auth";
import { recurringOrderSchema } from "@/lib/validations/order";

/** CLI-09 : commandes récurrentes du client. */
export async function GET() {
  return withApiHandler(async () => {
    const guard = await requireMerchantActor();
    if ("error" in guard) return guard.error;
    return NextResponse.json({ data: await listRecurringOrders(merchantRef(guard.actor)), success: true });
  });
}

export async function POST(request: Request) {
  return withApiHandler(async () => {
    const guard = await requireMerchantActor();
    if ("error" in guard) return guard.error;
    const input = recurringOrderSchema.parse(await readJsonBody(request));
    return NextResponse.json({ data: await createRecurringOrder(merchantRef(guard.actor), input), success: true }, { status: 201 });
  });
}
