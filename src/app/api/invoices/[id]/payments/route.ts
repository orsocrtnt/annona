import { NextResponse } from "next/server";
import { recordPayment } from "@/domains/invoice/invoice-payment.service";
import { readJsonBody, withApiHandler } from "@/lib/api/route-handler";
import { requireCompanyAdmin } from "@/lib/api/tenant-auth";
import { recordPaymentSchema } from "@/lib/validations/invoice";

/** FACT-1 — règlement saisi par l'administrateur (RG-07) : montant, date, mode, référence. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return withApiHandler(async () => {
    const guard = await requireCompanyAdmin("invoices:update");
    if ("error" in guard) return guard.error;
    const { id } = await params;
    const input = recordPaymentSchema.parse(await readJsonBody(request));
    const data = await recordPayment({ companyId: guard.actor.companyId, userId: guard.actor.user.id }, id, input);
    return NextResponse.json({ data, success: true }, { status: 201 });
  });
}
