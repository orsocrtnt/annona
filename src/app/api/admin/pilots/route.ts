import { NextResponse } from "next/server";
import { requireRole, requireStaffRole } from "@/lib/api/auth-guard";
import { gatePlatformRead, gatePlatformWrite } from "@/lib/api/platform-access";
import { createPilot, listPilots } from "@/domains/admin/pilots.service";

const noStore = { "Cache-Control": "no-store" };

/**
 * ADMIN-ESPACE lot 4 : pilotes accompagnés (liste et création), super-administrateur seulement.
 * Ressource « entreprises » du journal : l'enum reste inchangé (aucune migration supplémentaire).
 */
export async function GET() {
  const auth = await requireStaffRole("dashboard:admin");
  if ("error" in auth) return auth.error;
  const denied = requireRole(auth.context, ["SUPER_ADMIN"]);
  const blocked = await gatePlatformRead(auth.context, denied, "COMPANIES");
  if (blocked) return blocked;

  try {
    const data = await listPilots();
    return NextResponse.json({ data, success: true }, { headers: noStore });
  } catch {
    return NextResponse.json({ error: "Pilotes indisponibles." }, { status: 500, headers: noStore });
  }
}

export async function POST(request: Request) {
  const auth = await requireStaffRole("dashboard:admin");
  if ("error" in auth) return auth.error;
  const denied = requireRole(auth.context, ["SUPER_ADMIN"]);
  const blocked = await gatePlatformWrite(auth.context, denied, "COMPANIES", "POST");
  if (blocked) return blocked;

  const body = await request.json().catch(() => null);
  try {
    const result = await createPilot(body, auth.context.user.id);
    if ("id" in result) {
      return NextResponse.json({ data: { id: result.id }, success: true }, { status: 201, headers: noStore });
    }
    if (!("error" in result)) return NextResponse.json({ error: "Pilote introuvable" }, { status: 404, headers: noStore });
    return NextResponse.json({ error: result.error }, { status: result.status === "conflict" ? 409 : 400, headers: noStore });
  } catch {
    return NextResponse.json({ error: "Enregistrement impossible." }, { status: 500, headers: noStore });
  }
}
