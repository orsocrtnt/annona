import { NextResponse } from "next/server";
import { requireDriverRole } from "@/lib/api/auth-guard";
import { prisma } from "@/services/prisma/client";
import { getPodPhotoSignedUrl } from "@/lib/storage/pod";

/** La photo se charge séparément : Storage ne bloque pas les missions actives. */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireDriverRole();
  if ("error" in auth) return auth.error;
  const { id: driverId, companyId } = auth.context.user;
  if (!companyId) return NextResponse.json({ error: "Entreprise non associée" }, { status: 403 });
  const { id } = await params;
  const mission = await prisma.delivery.findFirst({
    where: { id, driverId, companyId }, select: { podPhotoPath: true },
  });
  const url = mission ? await getPodPhotoSignedUrl(mission.podPhotoPath, companyId, id) : null;
  if (!url) return NextResponse.json({ error: "Photo indisponible" }, { status: 404, headers: { "Cache-Control": "private, no-store" } });
  return NextResponse.redirect(url, { status: 307, headers: { "Cache-Control": "private, no-store" } });
}
