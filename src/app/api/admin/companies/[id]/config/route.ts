import { NextResponse } from "next/server";
import { requireRole, requireStaffRole } from "@/lib/api/auth-guard";
import { configureCompany, getCompanyConfig } from "@/domains/admin/company-admin.service";
import { readJsonBody, withApiHandler } from "@/lib/api/route-handler";
import { configureCompanySchema } from "@/lib/validations/company-admin";

const noStore = { "Cache-Control": "no-store" };

/** PLA-02 : configuration d'une entreprise (nom, heure limite, fuseau, délai du rappel), super-administrateur. */
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  return withApiHandler(async () => {
    const auth = await requireStaffRole("dashboard:admin");
    if ("error" in auth) return auth.error;
    const denied = requireRole(auth.context, ["SUPER_ADMIN"]);
    if (denied) return denied;
    const { id } = await context.params;
    return NextResponse.json({ data: await getCompanyConfig(id), success: true }, { headers: noStore });
  });
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  return withApiHandler(async () => {
    const auth = await requireStaffRole("dashboard:admin");
    if ("error" in auth) return auth.error;
    const denied = requireRole(auth.context, ["SUPER_ADMIN"]);
    if (denied) return denied;
    const { id } = await context.params;
    const input = configureCompanySchema.parse(await readJsonBody(request));
    return NextResponse.json({ data: await configureCompany(id, input), success: true }, { headers: noStore });
  });
}
