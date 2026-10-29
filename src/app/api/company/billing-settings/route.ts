import { zodIssueMessage } from "@/lib/config-messages";
import { NextResponse } from "next/server";
import { getCompanyId, requireRole, requireStaffRole } from "@/lib/api/auth-guard";
import { readJsonBody, withApiHandler } from "@/lib/api/route-handler";
import { checkSellerReadiness } from "@/domains/invoice/facturx/facturx-readiness";
import { getCompanyEinvoicing } from "@/domains/invoice/facturx/facturx.service";
import {
  getCompanyBillingSettings,
  updateCompanyBillingSettings,
} from "@/domains/company/billing-settings.service";
import { companyBillingSettingsSchema } from "@/lib/validations/billing-settings";
import { readinessFieldErrors } from "@/lib/validations/einvoicing";

const BILLING_FIELD_LABELS = { courier: "Tarifs course", invoice: "Facturation", vatRate: "Taux de TVA", defaultDueDays: "Délai de paiement", referencePrefix: "Préfixe des références" };

export async function GET() {
  return withApiHandler(async () => {
    const auth = await requireStaffRole("settings:read");
    if ("error" in auth) return auth.error;
    const denied = requireRole(auth.context, ["COMPANY_ADMIN", "MINI_ADMIN"]);
    if (denied) return denied;

    const companyId = getCompanyId(auth.context);
    if (!companyId) {
      return NextResponse.json({ error: "Entreprise non associée" }, { status: 400 });
    }

    const settings = await getCompanyBillingSettings(companyId);
    return NextResponse.json({ data: settings, success: true });
  });
}

export async function PATCH(request: Request) {
  return withApiHandler(async () => {
    const auth = await requireStaffRole("settings:update");
    if ("error" in auth) return auth.error;
    const denied = requireRole(auth.context, ["COMPANY_ADMIN", "MINI_ADMIN"]);
    if (denied) return denied;

    const companyId = getCompanyId(auth.context);
    if (!companyId) {
      return NextResponse.json({ error: "Entreprise non associée" }, { status: 400 });
    }

    const body = await readJsonBody(request);
    const parsed = companyBillingSettingsSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: zodIssueMessage(parsed.error, "Données invalides", BILLING_FIELD_LABELS),
        },
        { status: 400 }
      );
    }

    // Taux de TVA modifié avec la facture électronique activée : la configuration qui en résulte doit être prête
    // (n° de TVA au-dessus de 0 %, motif d'exonération à 0 %). Un PATCH qui ne touche pas au taux n'est jamais bloqué.
    const einvoicing = await getCompanyEinvoicing(companyId);
    if (einvoicing?.einvoicing.enabled === true) {
      const previousRate = (await getCompanyBillingSettings(companyId)).invoice.vatRate;
      if (previousRate !== parsed.data.invoice.vatRate) {
        const issues = checkSellerReadiness({ ...einvoicing, vatRate: parsed.data.invoice.vatRate });
        if (issues.length > 0) {
          return NextResponse.json(
            {
              error: `Enregistrement refusé : ${issues[0]!.message} Complétez d'abord « Mentions légales et Factur-X », ou désactivez la facture électronique.`,
              fieldErrors: readinessFieldErrors(issues),
            },
            { status: 400 }
          );
        }
      }
    }

    try {
      const settings = await updateCompanyBillingSettings(companyId, parsed.data);
      return NextResponse.json({ data: settings, success: true });
    } catch (error) {
      if (error instanceof Error && error.message === "COMPANY_NOT_FOUND") {
        return NextResponse.json({ error: "Entreprise introuvable" }, { status: 404 });
      }
      if (error instanceof Error && error.message === "SETTINGS_CONFLICT") {
        return NextResponse.json({ error: "Les réglages ont changé pendant l'enregistrement. Rechargez puis réessayez." }, { status: 409 });
      }
      throw error;
    }
  });
}
