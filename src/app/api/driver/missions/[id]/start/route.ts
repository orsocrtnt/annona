import { NextResponse } from "next/server";
import { requireDriverRole } from "@/lib/api/auth-guard";
import { startDeliveryMissionByDriver } from "@/domains/delivery/start-delivery-mission.service";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireDriverRole();
  if ("error" in auth) return auth.error;

  const { id } = await params;

  try {
    const mission = await startDeliveryMissionByDriver(auth.context.user.id, id);
    if (!mission) {
      return NextResponse.json({ error: "Mission introuvable" }, { status: 404 });
    }
    return NextResponse.json({ data: mission, success: true });
  } catch (error) {
    if (error instanceof Error && error.message === "MISSION_ALREADY_STARTED") {
      return NextResponse.json({ error: "La mission est déjà en cours." }, { status: 409 });
    }
    console.error("POST /api/driver/missions/[id]/start failed:", error);
    return NextResponse.json(
      { error: "Impossible de démarrer la mission. Réessayez dans un instant." },
      { status: 500 }
    );
  }
}
