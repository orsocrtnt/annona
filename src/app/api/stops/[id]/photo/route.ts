import { NextResponse } from "next/server";
import { readStopIncidentPhoto } from "@/domains/round/round-live.service";
import { withApiHandler } from "@/lib/api/route-handler";
import { requireCompanyAdmin } from "@/lib/api/tenant-auth";
import { readPodObject } from "@/lib/storage/pod";

export const runtime = "nodejs";

/** LIV-05 : photo d'un problème signalé, servie en privé à l'administrateur de l'entreprise. */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  return withApiHandler(async () => {
    const guard = await requireCompanyAdmin("rounds:read");
    if ("error" in guard) return guard.error;
    const { id } = await params;
    const photo = await readStopIncidentPhoto(guard.actor.companyId, id, (path, companyId, stopId) => readPodObject("photo", path, companyId, stopId));
    if (!photo) return NextResponse.json({ error: "Aucune photo", success: false }, { status: 404 });
    return new NextResponse(new Uint8Array(photo.bytes), {
      headers: { "Content-Type": photo.contentType, "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" },
    });
  });
}
