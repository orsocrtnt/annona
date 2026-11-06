import { NextResponse } from "next/server";
import { requireRole, requireStaffRole } from "@/lib/api/auth-guard";
import { getAdminHome, parseAdminHomeParams } from "@/domains/admin/admin-home.service";

/** ADMIN-ESPACE : accueil du super-administrateur, et pastilles du menu avec `view=badges`. */
export async function GET(request: Request) {
  const auth = await requireStaffRole("dashboard:admin");
  if ("error" in auth) return auth.error;
  const denied = requireRole(auth.context, ["SUPER_ADMIN"]);
  // Même ressource journalisée que la vue d'ensemble : l'enum du journal reste inchangé (aucune migration).
  if (denied) return denied;

  const parsed = parseAdminHomeParams(new URL(request.url).searchParams);
  if ("error" in parsed) {
    return NextResponse.json({ error: parsed.error }, { status: 400, headers: { "Cache-Control": "no-store" } });
  }

  try {
    const data = await getAdminHome(parsed.query);
    return NextResponse.json(
      { data, success: true },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch {
    return NextResponse.json(
      { error: "Accueil plateforme indisponible." },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}
