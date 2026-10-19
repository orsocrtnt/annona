import { NextResponse } from "next/server";
import { requireDriverRole } from "@/lib/api/auth-guard";
import { checkDriverMissionProximity } from "@/domains/delivery/driver-proximity.service";
import type { ProximityTargetKind } from "@/lib/maps/driver-proximity";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireDriverRole();
  if ("error" in auth) return auth.error;
  const companyId = auth.context.user.companyId;
  if (!companyId) return NextResponse.json({ error: "Entreprise non associée" }, { status: 403 });

  const { id } = await params;
  const { searchParams } = new URL(request.url);
  const kind = searchParams.get("kind");

  if (kind !== "pickup" && kind !== "delivery") {
    return NextResponse.json({ error: "Type de point invalide" }, { status: 400 });
  }

  const latitude = searchParams.get("latitude");
  const longitude = searchParams.get("longitude");
  const overridePosition =
    latitude && longitude
      ? { latitude: Number(latitude), longitude: Number(longitude) }
      : null;

  if (
    overridePosition &&
    (Number.isNaN(overridePosition.latitude) || Number.isNaN(overridePosition.longitude))
  ) {
    return NextResponse.json({ error: "Coordonnées invalides" }, { status: 400 });
  }

  const result = await checkDriverMissionProximity(
    auth.context.user.id,
    companyId,
    id,
    kind as ProximityTargetKind,
    overridePosition
  );

  if (!result) {
    return NextResponse.json({ error: "Mission introuvable" }, { status: 404 });
  }

  return NextResponse.json({ data: result, success: true });
}
