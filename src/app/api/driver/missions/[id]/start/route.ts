import { z } from "zod";
import { NextResponse } from "next/server";
import { requireDriverRole } from "@/lib/api/auth-guard";
import { startDeliveryMissionByDriver } from "@/domains/delivery/start-delivery-mission.service";
import { omitStoragePaths } from "@/domains/delivery/proof-links";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireDriverRole();
  if ("error" in auth) return auth.error;
  const companyId = auth.context.user.companyId;
  if (!companyId) return NextResponse.json({ error: "Entreprise non associée" }, { status: 403 });

  const input = z.object({ expectedUpdatedAt: z.iso.datetime() }).safeParse(await request.json().catch(() => null));
  if (!input.success) return NextResponse.json({ error: "Version de mission requise." }, { status: 400 });
  const { id } = await params;

  try {
    const mission = await startDeliveryMissionByDriver(auth.context.user.id, companyId, id, new Date(input.data.expectedUpdatedAt));
    if (!mission) {
      return NextResponse.json({ error: "Mission introuvable" }, { status: 404 });
    }
    return NextResponse.json({ data: omitStoragePaths(mission), success: true });
  } catch (error) {
    if (error instanceof Error && error.message === "MISSION_ACCEPTANCE_REQUIRED") {
      return NextResponse.json(
        { error: "Prenez en charge la mission avant de commencer.", code: error.message },
        { status: 409 }
      );
    }
    if (error instanceof Error && error.message === "MISSION_ALREADY_STARTED") {
      return NextResponse.json(
        { error: "La mission est déjà en cours.", code: "MISSION_ALREADY_STARTED" },
        { status: 409 }
      );
    }
    if (error instanceof Error && error.message === "MISSION_START_CONFLICT") {
      return NextResponse.json(
        {
          error: "La mission a changé entre-temps. Rechargez la page avant de réessayer.",
          code: "MISSION_START_CONFLICT",
        },
        { status: 409 }
      );
    }
    console.error("POST /api/driver/missions/[id]/start failed:", error);
    return NextResponse.json(
      { error: "Impossible de démarrer la mission. Réessayez dans un instant." },
      { status: 500 }
    );
  }
}
