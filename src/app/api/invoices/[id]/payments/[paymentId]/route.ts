import { NextResponse } from "next/server";
import { deletePayment } from "@/domains/invoice/invoice-payment.service";
import { withApiHandler } from "@/lib/api/route-handler";
import { requireCompanyAdmin } from "@/lib/api/tenant-auth";

/** FACT-1 — suppression d'un règlement saisi par erreur (journalisée, statut recalculé). */
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string; paymentId: string }> }) {
  return withApiHandler(async () => {
    const guard = await requireCompanyAdmin("invoices:update");
    if ("error" in guard) return guard.error;
    const { id, paymentId } = await params;
    const data = await deletePayment({ companyId: guard.actor.companyId, userId: guard.actor.user.id }, id, paymentId);
    return NextResponse.json({ data, success: true });
  });
}
