import { NextResponse } from "next/server";
import { getCompanyId, requireStaffRole } from "@/lib/api/auth-guard";
import {
  adminUpdateDelivery,
  getCompanyDeliveryById,
} from "@/domains/delivery/delivery.service";
import { adminUpdateDeliverySchema } from "@/lib/validations/delivery";
import { getPodPhotoSignedUrl } from "@/lib/storage/pod";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireStaffRole("deliveries:read");
  if ("error" in auth) return auth.error;

  const companyId = getCompanyId(auth.context);
  if (!companyId) {
    return NextResponse.json({ error: "Entreprise non associée" }, { status: 400 });
  }

  const { id } = await params;
  const delivery = await getCompanyDeliveryById(companyId, id);

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

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireStaffRole("deliveries:update");
  if ("error" in auth) return auth.error;

  const companyId = getCompanyId(auth.context);
  if (!companyId) {
    return NextResponse.json({ error: "Entreprise non associée" }, { status: 400 });
  }

  const body = await request.json();
  const parsed = adminUpdateDeliverySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Données invalides", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { id } = await params;
  const delivery = await adminUpdateDelivery(companyId, id, parsed.data);

  if (!delivery) {
    return NextResponse.json({ error: "Livraison introuvable" }, { status: 404 });
  }

  return NextResponse.json({ data: delivery, success: true });
}
