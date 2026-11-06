import { NextResponse } from "next/server";
import { getMerchantOrder } from "@/domains/order/merchant-order.service";
import { merchantRef } from "@/lib/api/merchant-ref";
import { withApiHandler } from "@/lib/api/route-handler";
import { requireMerchantActor } from "@/lib/api/tenant-auth";

/** Détail d'une commande du client ; celle d'un autre client est introuvable (404). */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  return withApiHandler(async () => {
    const guard = await requireMerchantActor();
    if ("error" in guard) return guard.error;
    const { id } = await params;
    return NextResponse.json({ data: await getMerchantOrder(merchantRef(guard.actor), id), success: true });
  });
}
