import { NextResponse } from "next/server";
import { checkSellerAdvisories, checkSellerReadiness } from "@/domains/invoice/facturx/facturx-readiness";
import { companyUsesEinvoicing, getCompanyEinvoicing, updateCompanyEinvoicing } from "@/domains/invoice/facturx/facturx.service";
import { getCompanyId, requireRole, requireStaffRole } from "@/lib/api/auth-guard";
import { withApiHandler } from "@/lib/api/route-handler";
import { companyEinvoicingUpdateSchema, readinessFieldErrors, zodFieldErrors } from "@/lib/validations/einvoicing";

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
    // Données héritées : la page s'ouvre toujours et montre ce qui manque, sans erreur.
    const enforced = data.einvoicing.enabled === true || (await companyUsesEinvoicing(companyId));
    return NextResponse.json({ data: { ...data, enforced, missing: checkSellerReadiness(data), advisories: checkSellerAdvisories(data) }, success: true });
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
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Données invalides", fieldErrors: zodFieldErrors(parsed.error) },
        { status: 400 }
      );
    }

    // Même règle que l'export Factur-X. Bloquant dès que l'entreprise active ou utilise la facture électronique.
    const missing = checkSellerReadiness(parsed.data);
    const enforced = parsed.data.einvoicing.enabled === true || (missing.length > 0 && (await companyUsesEinvoicing(companyId)));
    if (enforced && missing.length > 0) {
      return NextResponse.json(
        {
          error: `Enregistrement refusé : ${missing.length} mention${missing.length > 1 ? "s" : ""} exigée${missing.length > 1 ? "s" : ""} par la facture électronique ${missing.length > 1 ? "manquent" : "manque"}. ${missing[0]!.message}`,
          fieldErrors: readinessFieldErrors(missing),
        },
        { status: 400 }
      );
    }

    try {
      const data = await updateCompanyEinvoicing(companyId, parsed.data);
      // Entreprise non bloquée : l'enregistrement réussit mais montre ce qui manquerait à l'export.
      return NextResponse.json({ data: { ...data, enforced, missing, advisories: checkSellerAdvisories(parsed.data) }, success: true });
    } catch (error) {
      if (error instanceof Error && error.message === "COMPANY_NOT_FOUND") {
        return NextResponse.json({ error: "Entreprise introuvable" }, { status: 404 });
      }
      if (error instanceof Error && error.message === "SETTINGS_CONFLICT") {
        return NextResponse.json({ error: "Les réglages ont changé pendant l'enregistrement. Rechargez puis réessayez." }, { status: 409 });
      }
      if (error instanceof Error && error.message === "COMPANY_IDENTITY_TAKEN") {
        return NextResponse.json({ error: "Ce SIREN ou ce SIRET est déjà utilisé par une autre entreprise." }, { status: 409 });
      }
      throw error;
    }
  });
}
