import { NextResponse } from "next/server";
import { requireRole, requireStaffRole } from "@/lib/api/auth-guard";
import { gatePlatformRead, gatePlatformWrite } from "@/lib/api/platform-access";
import { getPilot, isPilotId, updatePilot } from "@/domains/admin/pilots.service";

const noStore = { "Cache-Control": "no-store" };

/** ADMIN-ESPACE lot 4 : fiche d'un pilote (notes, courbe 30 jours de l'entreprise liée). */
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireStaffRole("dashboard:admin");
  if ("error" in auth) return auth.error;
  const denied = requireRole(auth.context, ["SUPER_ADMIN"]);
  const blocked = await gatePlatformRead(auth.context, denied, "COMPANIES");
  if (blocked) return blocked;

  const { id } = await context.params;
  if (!isPilotId(id)) return NextResponse.json({ error: "Pilote introuvable" }, { status: 404, headers: noStore });
  try {
    const data = await getPilot(id);
    if (!data) return NextResponse.json({ error: "Pilote introuvable" }, { status: 404, headers: noStore });
    return NextResponse.json({ data, success: true }, { headers: noStore });
  } catch {
    return NextResponse.json({ error: "Pilote indisponible." }, { status: 500, headers: noStore });
  }
}

/** Modification des champs ou changement d'étape (transitions et dates contrôlées par le service). */
export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireStaffRole("dashboard:admin");
  if ("error" in auth) return auth.error;
  const denied = requireRole(auth.context, ["SUPER_ADMIN"]);
  const blocked = await gatePlatformWrite(auth.context, denied, "COMPANIES", "PATCH");
  if (blocked) return blocked;

  const { id } = await context.params;
  if (!isPilotId(id)) return NextResponse.json({ error: "Pilote introuvable" }, { status: 404, headers: noStore });
  const body = await request.json().catch(() => null);
  try {
    const result = await updatePilot(id, body, auth.context.user.id);
    if ("id" in result) {
      return NextResponse.json({ data: { id: result.id }, success: true }, { headers: noStore });
    }
    if (!("error" in result)) return NextResponse.json({ error: "Pilote introuvable" }, { status: 404, headers: noStore });
    return NextResponse.json({ error: result.error }, { status: result.status === "conflict" ? 409 : 400, headers: noStore });
  } catch {
    return NextResponse.json({ error: "Enregistrement impossible." }, { status: 500, headers: noStore });
  }
}
