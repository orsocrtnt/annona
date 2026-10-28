import { trackingTimeline } from "@/domains/tracking/tracking.policy";
import { NextResponse } from "next/server";
import { requireClientRole } from "@/lib/api/auth-guard";
import { getClientOrderById } from "@/domains/order/order.service";
import { withProofLinks } from "@/domains/delivery/proof-links";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireClientRole();
  if ("error" in auth) return auth.error;
  const companyId = auth.context.user.companyId;
  if (!companyId) {
    return NextResponse.json({ error: "Entreprise non associée" }, { status: 403 });
  }

  const { id } = await params;
  const order = await getClientOrderById(auth.context.user.id, companyId, id);

  if (!order) {
    return NextResponse.json({ error: "Commande introuvable" }, { status: 404 });
  }

  const deliveries = order.deliveries
    .filter(d => d.companyId === companyId && d.customerId === auth.context.user.id)
    .map(d => ({
      ...withProofLinks("/api/portal/deliveries", d),
      trackingEvents: trackingTimeline(d.trackingEvents),
    }));
  return NextResponse.json({ data: { ...order, deliveries }, success: true });
}
