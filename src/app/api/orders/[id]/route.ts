import { NextResponse } from "next/server";
import { correctAdminOrder, getAdminOrder } from "@/domains/order/admin-order.service";
import { readJsonBody, withApiHandler } from "@/lib/api/route-handler";
import { requireCompanyAdmin } from "@/lib/api/tenant-auth";
import { adminCorrectOrderSchema } from "@/lib/validations/order";

/** ADM-04 / ADM-05 : détail d'une commande de l'entreprise, avec son historique (RG-10). */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  return withApiHandler(async () => {
    const guard = await requireCompanyAdmin("orders:read");
    if ("error" in guard) return guard.error;
    const { id } = await params;
    return NextResponse.json({ data: await getAdminOrder(guard.actor.companyId, id), success: true });
  });
}

/** ADM-05 : correction (lignes complètes après correction), journalisée avec auteur, avant et après (RG-10). */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return withApiHandler(async () => {
    const guard = await requireCompanyAdmin("orders:update");
    if ("error" in guard) return guard.error;
    const { id } = await params;
    const input = adminCorrectOrderSchema.parse(await readJsonBody(request));
    const data = await correctAdminOrder({ companyId: guard.actor.companyId, userId: guard.actor.user.id }, id, input);
    return NextResponse.json({ data, success: true });
  });
}
