import { NextResponse } from "next/server";
import { findMerchantOrderFor } from "@/domains/order/merchant-order.service";
import { merchantRef } from "@/lib/api/merchant-ref";
import { withApiHandler } from "@/lib/api/route-handler";
import { requireMerchantActor } from "@/lib/api/tenant-auth";
import { orderLookupSchema } from "@/lib/validations/order";

/** CLI-05 : commande existante du client pour une date et un créneau (ouverte en modification), ou null. */
export async function GET(request: Request) {
  return withApiHandler(async () => {
    const guard = await requireMerchantActor();
    if ("error" in guard) return guard.error;
    const params = new URL(request.url).searchParams;
    const { date, slotId } = orderLookupSchema.parse({ date: params.get("date"), slotId: params.get("slotId") });
    return NextResponse.json({ data: await findMerchantOrderFor(merchantRef(guard.actor), date, slotId), success: true });
  });
}
