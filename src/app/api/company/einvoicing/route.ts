import { NextResponse } from "next/server";
import { getCompanyEinvoicing, updateCompanyEinvoicing } from "@/domains/invoice/facturx/facturx.service";
import { getCompanyId, requireRole, requireStaffRole } from "@/lib/api/auth-guard";
import { withApiHandler } from "@/lib/api/route-handler";
import { companyEinvoicingUpdateSchema } from "@/lib/validations/einvoicing";

/** Mentions légales et paramètres Factur-X : administrateur de l'entreprise uniquement (SIREN, IBAN…). */
export async function GET() {
  return withApiHandler(async () => {
    const auth = await requireStaffRole("settings:read");
    if ("error" in auth) return auth.error;
    const denied = requireRole(auth.context, ["COMPANY_ADMIN"]);
    if (denied) return denied;
    const companyId = getCompanyId(auth.context);
    if (!companyId) return NextResponse.json({ error: "Entreprise non associée" }, { status: 400 });

    const data = await getCompanyEinvoicing(companyId);
    if (!data) return NextResponse.json({ error: "Entreprise introuvable" }, { status: 404 });
    return NextResponse.json({ data, success: true });
  });
}

export async function PATCH(request: Request) {
  return withApiHandler(async () => {
    const auth = await requireStaffRole("settings:update");
    if ("error" in auth) return auth.error;
    const denied = requireRole(auth.context, ["COMPANY_ADMIN"]);
    if (denied) return denied;
    const companyId = getCompanyId(auth.context);
    if (!companyId) return NextResponse.json({ error: "Entreprise non associée" }, { status: 400 });

    const parsed = companyEinvoicingUpdateSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Données invalides" }, { status: 400 });
    }

    try {
      const data = await updateCompanyEinvoicing(companyId, parsed.data);
      return NextResponse.json({ data, success: true });
    } catch (error) {
      if (error instanceof Error && error.message === "COMPANY_NOT_FOUND") {
        return NextResponse.json({ error: "Entreprise introuvable" }, { status: 404 });
      }
      if (error instanceof Error && error.message === "COMPANY_IDENTITY_TAKEN") {
        return NextResponse.json({ error: "Ce SIREN ou ce SIRET est déjà utilisé par une autre entreprise." }, { status: 409 });
      }
      throw error;
    }
  });
}
