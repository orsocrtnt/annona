import { NextResponse } from "next/server";
import { z } from "zod";
import { requireDriverRole } from "@/lib/api/auth-guard";
import { acknowledgeDeliveryMissionByDriver } from "@/domains/delivery/acknowledge-delivery-mission.service";

const inputSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("accept"), expectedUpdatedAt: z.iso.datetime() }),
  z.object({ action: z.literal("decline"), expectedUpdatedAt: z.iso.datetime(), reason: z.string().trim().min(1).max(500) }),
]);

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireDriverRole();
  if ("error" in auth) return auth.error;
  const companyId = auth.context.user.companyId;
  if (!companyId) return NextResponse.json({ error: "Entreprise non associée" }, { status: 403 });
  const input = inputSchema.safeParse(await request.json().catch(() => null));
  if (!input.success) return NextResponse.json({ error: "Version de mission et motif de refus valides requis." }, { status: 400 });
  const { id } = await params;
  try {
    const mission = await acknowledgeDeliveryMissionByDriver(auth.context.user.id, companyId, id, {
      ...input.data, expectedUpdatedAt: new Date(input.data.expectedUpdatedAt),
    });
    if (!mission) return NextResponse.json({ error: "Mission introuvable" }, { status: 404 });
    return NextResponse.json({ data: mission, success: true });
  } catch (error) {
    if (error instanceof Error && error.message === "MISSION_ACK_CONFLICT") {
      return NextResponse.json({ error: "La mission a changé. Actualisez-la avant de réessayer.", code: error.message }, { status: 409 });
    }
    console.error("Mission acknowledgement failed", error);
    return NextResponse.json({ error: "Impossible de mettre à jour la prise en charge." }, { status: 500 });
  }
}
