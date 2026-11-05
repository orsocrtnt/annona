import { after, NextResponse } from "next/server";
import { requireRole, requireStaffRole } from "@/lib/api/auth-guard";
import { gatePlatformRead, gatePlatformWrite } from "@/lib/api/platform-access";
import { getDemoPoolOccupancy } from "@/domains/demo/demo-pool.service";
import { listDemoPoolEnvironments, queueAdminDemoReset } from "@/domains/demo/demo-pool-admin.service";

const noStore = { "Cache-Control": "no-store" };

/** Super admin : démos disponibles sur le total, visiteurs en direct et détail de chaque espace. */
export async function GET() {
  const auth = await requireStaffRole("dashboard:admin");
  if ("error" in auth) return auth.error;
  const denied = requireRole(auth.context, ["SUPER_ADMIN"]);
  const blocked = await gatePlatformRead(auth.context, denied, "OVERVIEW");
  if (blocked) return blocked;

  const now = new Date();
  const [summary, environments] = await Promise.all([getDemoPoolOccupancy(now), listDemoPoolEnvironments(now)]);
  return NextResponse.json({ data: { ...summary, environments }, success: true }, { headers: noStore });
}

/**
 * Remise à neuf d'une démo (`{ id }`) ou de toutes celles où personne n'est en direct (`{}`). Les espaces de
 * démonstration appartiennent à la plateforme : aucune entreprise cliente n'est touchée.
 */
export async function POST(request: Request) {
  const auth = await requireStaffRole("dashboard:admin");
  if ("error" in auth) return auth.error;
  const denied = requireRole(auth.context, ["SUPER_ADMIN"]);
  const blocked = await gatePlatformWrite(auth.context, denied, "OVERVIEW", "POST");
  if (blocked) return blocked;

  const body = (await request.json().catch(() => null)) as { id?: unknown } | null;
  const id = typeof body?.id === "string" && body.id.length <= 64 ? body.id : undefined;
  if (body?.id !== undefined && !id) {
    return NextResponse.json({ error: "Démo inconnue." }, { status: 400, headers: noStore });
  }
  const { queued, rebuild } = await queueAdminDemoReset({ id });
  if (id && queued === 0) {
    return NextResponse.json({ error: "Cette démo est déjà en préparation." }, { status: 409, headers: noStore });
  }
  if (queued > 0) {
    // Reconstruit exactement les démos demandées, après la réponse.
    after(rebuild);
  }
  return NextResponse.json({ data: { queued }, success: true }, { status: 202, headers: noStore });
}
