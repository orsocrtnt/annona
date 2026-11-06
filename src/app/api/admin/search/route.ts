import { NextResponse } from "next/server";
import { requireRole, requireStaffRole } from "@/lib/api/auth-guard";
import { allowAdminSearch, parseAdminSearchParams, searchPlatform } from "@/domains/admin/search.service";

/** ADMIN-ESPACE lot 3 : recherche globale du super-administrateur (entreprises, utilisateurs, commandes, contacts). */
export async function GET(request: Request) {
  const auth = await requireStaffRole("dashboard:admin");
  if ("error" in auth) return auth.error;
  const denied = requireRole(auth.context, ["SUPER_ADMIN"]);
  // Ressource « vue d'ensemble » du journal : la recherche traverse toute la plateforme (enum inchangé, aucune migration).
  if (denied) return denied;

  const parsed = parseAdminSearchParams(new URL(request.url).searchParams);
  if ("error" in parsed) {
    return NextResponse.json({ error: parsed.error }, { status: 400, headers: { "Cache-Control": "no-store" } });
  }
  if (!allowAdminSearch(auth.context.user.id)) {
    return NextResponse.json(
      { error: "Trop de recherches. Réessayez dans une minute." },
      { status: 429, headers: { "Cache-Control": "no-store", "Retry-After": "60" } }
    );
  }

  try {
    const data = await searchPlatform(parsed.query);
    return NextResponse.json({ data, success: true }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "Recherche indisponible." }, { status: 500, headers: { "Cache-Control": "no-store" } });
  }
}
