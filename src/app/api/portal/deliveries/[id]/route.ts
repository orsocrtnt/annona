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

  const { id } = await params;
  const delivery = await getClientDeliveryById(auth.context.user.id, id);

  if (!delivery) {
    return NextResponse.json({ error: "Livraison introuvable" }, { status: 404 });
  }

  return NextResponse.json({
    data: {
      ...delivery,
      podPhotoUrl: await getPodPhotoSignedUrl(delivery.podPhotoPath),
    },
    success: true,
  });
}
