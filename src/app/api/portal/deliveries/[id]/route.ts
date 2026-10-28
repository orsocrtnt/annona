import { trackingTimeline } from "@/domains/tracking/tracking.policy";
import { NextResponse } from "next/server";
import { requireClientRole } from "@/lib/api/auth-guard";
import { getClientDeliveryById } from "@/domains/delivery/delivery.service";
import { deliveryTiming } from "@/domains/delivery/delivery-timing";
import { withProofLinks } from "@/domains/delivery/proof-links";

function clientTiming(delivery: NonNullable<Awaited<ReturnType<typeof getClientDeliveryById>>>) {
  const { dueAt, late, lateByMinutes } = deliveryTiming({
    status: delivery.status,
    requestedDeliveryDate: delivery.order?.requestedDeliveryDate ?? null,
    completedAt: delivery.completedAt,
    driverId: delivery.driverId,
    missionAcceptedAt: delivery.missionAcceptedAt,
    hasProof: Boolean(delivery.podPhotoPath),
  });
  return { dueAt, late, lateByMinutes };
}

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
  const delivery = await getClientDeliveryById(auth.context.user.id, companyId, id);

  if (!delivery) {
    return NextResponse.json({ error: "Livraison introuvable" }, { status: 404 });
  }

  return NextResponse.json({
    data: {
      ...withProofLinks("/api/portal/deliveries", delivery),
      trackingEvents: trackingTimeline(delivery.trackingEvents),
      // Même règle de retard que l'équipe (UX-03) ; la prochaine action reste interne.
      timing: clientTiming(delivery),
    },
    success: true,
  });
}
