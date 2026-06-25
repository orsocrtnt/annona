import { NextResponse } from "next/server";
import { requireDriverRole } from "@/lib/api/auth-guard";
import {
  getDriverMissionById,
  updateDeliveryStatusByDriver,
} from "@/domains/delivery/delivery.service";
import { updateDriverDeliveryStatusSchema } from "@/lib/validations/delivery";
import { DriverProximityError } from "@/domains/delivery/driver-proximity.service";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireDriverRole();
  if ("error" in auth) return auth.error;

  const { id } = await params;
  const mission = await getDriverMissionById(auth.context.user.id, id);

  if (!mission) {
    return NextResponse.json({ error: "Mission introuvable" }, { status: 404 });
  }

  return NextResponse.json({ data: mission, success: true });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireDriverRole();
  if ("error" in auth) return auth.error;

  const body = await request.json();
  const parsed = updateDriverDeliveryStatusSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Données invalides", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { id } = await params;
  try {
    const mission = await updateDeliveryStatusByDriver(
      auth.context.user.id,
      id,
      parsed.data.status,
      {
        purchaseItems: parsed.data.purchaseItems,
        confirmOutOfRange: parsed.data.confirmOutOfRange,
        latitude: parsed.data.latitude,
        longitude: parsed.data.longitude,
      }
    );

    if (!mission) {
      return NextResponse.json({ error: "Mission introuvable" }, { status: 404 });
    }

    return NextResponse.json({ data: mission, success: true });
  } catch (error) {
    if (error instanceof DriverProximityError) {
      return NextResponse.json(
        {
          error: "Vous n'êtes pas proche du point attendu",
          code: error.code,
          kind: error.kind,
          distanceMeters: error.distanceMeters,
        },
        { status: 409 }
      );
    }
    if (error instanceof Error && error.message === "INVALID_PURCHASE_ITEMS") {
      return NextResponse.json({ error: "Articles invalides" }, { status: 400 });
    }
    if (error instanceof Error && error.message === "MISSION_NOT_STARTED") {
      return NextResponse.json(
        { error: "Démarrez d'abord la mission." },
        { status: 409 }
      );
    }
    if (error instanceof Error && error.message === "INVALID_STATUS_TRANSITION") {
      return NextResponse.json(
        { error: "Cette étape n'est pas disponible à ce stade de la mission." },
        { status: 409 }
      );
    }
    throw error;
  }
}
