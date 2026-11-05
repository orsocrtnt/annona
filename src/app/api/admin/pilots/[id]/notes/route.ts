import { NextResponse } from "next/server";
import { requireRole, requireStaffRole } from "@/lib/api/auth-guard";
import { gatePlatformWrite } from "@/lib/api/platform-access";
import { addPilotNote, isPilotId } from "@/domains/admin/pilots.service";

const noStore = { "Cache-Control": "no-store" };

/** ADMIN-ESPACE lot 4 : note de suivi d'un pilote (texte, auteur et date enregistrés). */
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireStaffRole("dashboard:admin");
  if ("error" in auth) return auth.error;
  const denied = requireRole(auth.context, ["SUPER_ADMIN"]);
  const blocked = await gatePlatformWrite(auth.context, denied, "COMPANIES", "POST");
  if (blocked) return blocked;

  const { id } = await context.params;
  if (!isPilotId(id)) return NextResponse.json({ error: "Pilote introuvable" }, { status: 404, headers: noStore });
  const body = await request.json().catch(() => null);
  try {
    const result = await addPilotNote(id, body, auth.context.user.id);
    if ("id" in result) {
      return NextResponse.json({ data: { id: result.id }, success: true }, { status: 201, headers: noStore });
    }
    if (!("error" in result)) return NextResponse.json({ error: "Pilote introuvable" }, { status: 404, headers: noStore });
    return NextResponse.json({ error: result.error }, { status: 400, headers: noStore });
  } catch {
    return NextResponse.json({ error: "Enregistrement impossible." }, { status: 500, headers: noStore });
  }
}
