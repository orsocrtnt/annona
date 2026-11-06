import { NextResponse } from "next/server";
import { listMerchantOrders, saveMerchantOrder } from "@/domains/order/merchant-order.service";
import { merchantRef } from "@/lib/api/merchant-ref";
import { readJsonBody, withApiHandler } from "@/lib/api/route-handler";
import { requireMerchantActor } from "@/lib/api/tenant-auth";
import { saveOrderSchema } from "@/lib/validations/order";

/** CLI-07 : commandes à venir (`scope=upcoming`) ou historique (`scope=history&before=AAAA-MM-JJ`). */
export async function GET(request: Request) {
  return withApiHandler(async () => {
    const guard = await requireMerchantActor();
    if ("error" in guard) return guard.error;
    const params = new URL(request.url).searchParams;
    const scope = params.get("scope") === "history" ? "history" : "upcoming";
    const data = await listMerchantOrders(merchantRef(guard.actor), { scope, before: params.get("before") });
    return NextResponse.json({ data, success: true });
  });
}

/**
 * CLI-04 à CLI-06 : crée ou modifie la commande unique du client pour (date, créneau), statut VALIDATED.
 * Refus serveur : date avant demain (400), heure limite passée (409), commande verrouillée (409).
 */
export async function PUT(request: Request) {
  return withApiHandler(async () => {
    const guard = await requireMerchantActor();
    if ("error" in guard) return guard.error;
    const input = saveOrderSchema.parse(await readJsonBody(request));
    const { order, created } = await saveMerchantOrder(merchantRef(guard.actor), input);
    return NextResponse.json({ data: order, created, success: true }, { status: created ? 201 : 200 });
  });
}
