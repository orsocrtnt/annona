import { refuseIfReadOnly } from "@/lib/api/saas-guard";
import { z } from "zod";
import { getCompanyId, requireRole, requireStaffRole } from "@/lib/api/auth-guard";
import { hasPermission } from "@/lib/permissions/rbac";
import {
  getOrderIntakeSettings,
  isOrderIntakeConfigured,
  setOrderIntakeEnabled,
} from "@/domains/order-intake/order-intake.settings";
import { companyHasSaasFeature } from "@/domains/saas/saas.service";
import { CONFIG_MESSAGES } from "@/lib/config-messages";
import { ORDER_INTAKE_DAILY_LIMIT, ORDER_INTAKE_HOURLY_LIMIT } from "@/domains/order-intake/order-intake.usage";
import { ORDER_INTAKE_MAX_TEXT_LENGTH } from "@/domains/order-intake/order-intake.schema";
import { intakeError, intakeJson, withIntakeErrors } from "./intake-http";

const toggleSchema = z.object({ enabled: z.boolean() }).strict();

/** État de la fonction pour l'entreprise de la session : activation, clé serveur, plafonds. */
export async function GET() {
  return withIntakeErrors(async () => {
    const auth = await requireStaffRole("orders:create");
    if ("error" in auth) return auth.error;
    const denied = requireRole(auth.context, ["COMPANY_ADMIN", "MINI_ADMIN", "DISPATCHER"]);
    if (denied) return denied;
    const companyId = getCompanyId(auth.context);
    if (!companyId) return intakeError("NO_COMPANY", "Entreprise non associée", 400);

    const [settings, included] = await Promise.all([
      getOrderIntakeSettings(companyId),
      companyHasSaasFeature(companyId, "order_automation"),
    ]);
    const role = auth.context.user.role.systemRole;
    return intakeJson({
      success: true,
      data: {
        enabled: settings.enabled,
        included,
        configured: isOrderIntakeConfigured(),
        canManage: (role === "COMPANY_ADMIN" || role === "MINI_ADMIN") && hasPermission(auth.context.permissions, "settings:update"),
        limits: { hourly: ORDER_INTAKE_HOURLY_LIMIT, daily: ORDER_INTAKE_DAILY_LIMIT, maxTextLength: ORDER_INTAKE_MAX_TEXT_LENGTH },
      },
    });
  });
}

/** Activation explicite par entreprise, réservée à l'administration des réglages. */
export async function PATCH(request: Request) {
  return withIntakeErrors(async () => {
    const auth = await requireStaffRole("settings:update");
    if ("error" in auth) return auth.error;
    const denied = requireRole(auth.context, ["COMPANY_ADMIN", "MINI_ADMIN"]);
    if (denied) return denied;
    const companyId = getCompanyId(auth.context);
    if (!companyId) return intakeError("NO_COMPANY", "Entreprise non associée", 400);
    const readOnly = await refuseIfReadOnly(companyId);
    if (readOnly) return readOnly;

    const parsed = toggleSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return intakeError("INVALID", "Réglage invalide", 400);
    // OFFER-1 : activer exige l'option ; désactiver reste toujours possible.
    if (parsed.data.enabled && !(await companyHasSaasFeature(companyId, "order_automation"))) {
      return intakeError("SAAS_FEATURE_NOT_AVAILABLE", CONFIG_MESSAGES.ORDER_AUTOMATION_NOT_INCLUDED, 403);
    }

    const settings = await setOrderIntakeEnabled(companyId, parsed.data.enabled);
    return intakeJson({ success: true, data: settings });
  });
}
