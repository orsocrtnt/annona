import { NextResponse } from "next/server";
import { confirmOrderChange } from "@/domains/notification/merchant-notification.service";
import { cancelAdminOrder } from "@/domains/order/admin-order.service";
import { readJsonBody, withApiHandler } from "@/lib/api/route-handler";
import { requireCompanyAdmin } from "@/lib/api/tenant-auth";
import { adminCancelOrderSchema } from "@/lib/validations/order";

/** ADM-05 : annulation par l'administrateur, retirée de sa tournée et journalisée (RG-10). */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return withApiHandler(async () => {
    const guard = await requireCompanyAdmin("orders:update");
    if ("error" in guard) return guard.error;
    const { id } = await params;
    const input = adminCancelOrderSchema.parse(await readJsonBody(request));
    const data = await cancelAdminOrder({ companyId: guard.actor.companyId, userId: guard.actor.user.id }, id, input);
    await confirmOrderChange({ companyId: guard.actor.companyId, merchantId: data.merchant.id, orderId: data.id, source: "ADMIN" });
    return NextResponse.json({ data, success: true });
  });
}
