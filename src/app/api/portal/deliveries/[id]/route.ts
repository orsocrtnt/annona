import { trackingTimeline } from "@/domains/tracking/tracking.policy";
import { NextResponse } from "next/server";
import { requireClientRole } from "@/lib/api/auth-guard";
import { getClientDeliveryById } from "@/domains/delivery/delivery.service";
import { getPodPhotoSignedUrl } from "@/lib/storage/pod";

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

  const { podPhotoPath, ...safeDelivery } = delivery;
  return NextResponse.json({
    data: {
      ...safeDelivery,
      trackingEvents: trackingTimeline(delivery.trackingEvents),
      podPhotoUrl: await getPodPhotoSignedUrl(podPhotoPath, delivery.companyId, delivery.id),
    },
    success: true,
  });
}
