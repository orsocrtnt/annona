import { NextResponse } from "next/server";
import { requireRole, requireStaffRole } from "@/lib/api/auth-guard";
import { createCompanyWithAdmin } from "@/domains/admin/company-admin.service";
import { readJsonBody, withApiHandler } from "@/lib/api/route-handler";
import { createCompanySchema } from "@/lib/validations/company-admin";

/**
 * PLA-02 : créer une entreprise (active, trois créneaux de départ) et inviter son premier
 * administrateur. Super-administrateur seulement ; aucune donnée d'une entreprise existante n'est lue.
 */
export async function POST(request: Request) {
  return withApiHandler(async () => {
    const auth = await requireStaffRole("dashboard:admin");
    if ("error" in auth) return auth.error;
    const denied = requireRole(auth.context, ["SUPER_ADMIN"]);
    if (denied) return denied;
    const input = createCompanySchema.parse(await readJsonBody(request));
    const data = await createCompanyWithAdmin(input);
    return NextResponse.json({ data, success: true }, { status: 201, headers: { "Cache-Control": "no-store" } });
  });
}
