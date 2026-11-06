import { NextResponse } from "next/server";
import { reorderMerchantOrder } from "@/domains/order/merchant-order.service";
import { merchantRef } from "@/lib/api/merchant-ref";
import { readJsonBody, withApiHandler } from "@/lib/api/route-handler";
import { requireMerchantActor } from "@/lib/api/tenant-auth";
import { reorderSchema } from "@/lib/validations/order";

/** CLI-08 / ENF-03 : recopie à l'identique pour une nouvelle date et un créneau, validée d'un coup. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return withApiHandler(async () => {
    const guard = await requireMerchantActor();
    if ("error" in guard) return guard.error;
    const { id } = await params;
    const target = reorderSchema.parse(await readJsonBody(request));
    const { order, droppedCount } = await reorderMerchantOrder(merchantRef(guard.actor), id, target);
    return NextResponse.json({ data: order, droppedCount, success: true }, { status: 201 });
  });
}
