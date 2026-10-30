import { NextResponse } from "next/server";
import { requireRole, requireStaffRole } from "@/lib/api/auth-guard";

type StaffAuth = Awaited<ReturnType<typeof requireStaffRole>>;

/**
 * DISPATCHER-403 : lecture des réglages dont dépend l'assignation (dispatch, zones tarifaires, cadence de
 * la carte). Administrateur ou mini-admin avec `settings:read`, ou dispatcher avec `deliveries:dispatch`
 * (sans ces réglages, sa liste de livreurs compatibles restait vide). L'écriture reste réservée aux
 * administrateurs (`settings:update`).
 */
export async function requireDispatchSettingsReader(): Promise<StaffAuth> {
  const auth = await requireStaffRole(["settings:read", "deliveries:dispatch"]);
  if ("error" in auth) return auth;
  const { permissions } = auth.context;
  const role = auth.context.user.role.systemRole;
  if (role === "DISPATCHER") return permissions.includes("deliveries:dispatch") ? auth : { error: NextResponse.json({ error: "Accès refusé" }, { status: 403 }) };
  const denied = requireRole(auth.context, ["COMPANY_ADMIN", "MINI_ADMIN"]);
  if (denied) return { error: denied };
  return permissions.includes("settings:read") ? auth : { error: NextResponse.json({ error: "Accès refusé" }, { status: 403 }) };
}
