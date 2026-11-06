import { NextResponse } from "next/server";
import { cancelMerchantOrder } from "@/domains/order/merchant-order.service";
import { merchantRef } from "@/lib/api/merchant-ref";
import { withApiHandler } from "@/lib/api/route-handler";
import { requireMerchantActor } from "@/lib/api/tenant-auth";

/** CLI-06 : annulation jusqu'à l'heure limite (409 ensuite). */
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  return withApiHandler(async () => {
    const guard = await requireMerchantActor();
    if ("error" in guard) return guard.error;
    const { id } = await params;
    return NextResponse.json({ data: await cancelMerchantOrder(merchantRef(guard.actor), id), success: true });
  });
}
