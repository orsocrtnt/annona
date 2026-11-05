import { NextResponse } from "next/server";
import { requireRole, requireStaffRole } from "@/lib/api/auth-guard";
import { gatePlatformRead } from "@/lib/api/platform-access";
import { readProspectionSheet } from "@/domains/admin/prospection-sheet.service";

/**
 * ADMIN-ESPACE lot 5 : chiffres du fichier de prospection (Google Sheet lue en lecture seule, cache 5 minutes).
 * Agrégats et rappels seulement, jamais le fichier entier. « À brancher » sans configuration.
 */
export async function GET() {
  const auth = await requireStaffRole("dashboard:admin");
  if ("error" in auth) return auth.error;
  const denied = requireRole(auth.context, ["SUPER_ADMIN"]);
  const blocked = await gatePlatformRead(auth.context, denied, "CONTACT_MESSAGES");
  if (blocked) return blocked;

  const data = await readProspectionSheet();
  return NextResponse.json({ data, success: true }, { headers: { "Cache-Control": "no-store" } });
}
