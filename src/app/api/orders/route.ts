import { NextResponse } from "next/server";
import { listAdminOrders } from "@/domains/order/admin-order.service";
import { ensureDateLocked } from "@/domains/order/order-lock.service";
import { withApiHandler } from "@/lib/api/route-handler";
import { requireCompanyAdmin } from "@/lib/api/tenant-auth";
import { adminOrdersQuerySchema } from "@/lib/validations/order";

/**
 * ADM-04 : commandes d'un jour, filtrables par client (`merchantId`) et par tournée (`roundId`,
 * `none` = sans tournée). Si l'heure limite du jour est passée, la date est verrouillée d'abord
 * (LOCK-1, appel paresseux) : l'écran ne dépend jamais d'un cron en retard.
 */
export async function GET(request: Request) {
  return withApiHandler(async () => {
    const guard = await requireCompanyAdmin("orders:read");
    if ("error" in guard) return guard.error;
    const params = new URL(request.url).searchParams;
    const query = adminOrdersQuerySchema.parse({
      date: params.get("date"),
      merchantId: params.get("merchantId") || undefined,
      roundId: params.get("roundId") || undefined,
    });
    const day = await ensureDateLocked(guard.actor.companyId, query.date);
    const data = await listAdminOrders(guard.actor.companyId, day, { merchantId: query.merchantId, roundId: query.roundId });
    return NextResponse.json({ data, success: true });
  });
}
