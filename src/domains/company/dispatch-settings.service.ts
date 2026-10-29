import { settingsSection } from "@/lib/database/claimed-settings-update";
import { updateCompanySettingsWithClaim } from "@/lib/database/settings-claims";
import { prisma } from "@/services/prisma/client";
import { resolveCompanySaasAccess } from "@/domains/saas/saas.service";
import {
  DEFAULT_DISPATCH_SETTINGS,
  companyDispatchSettingsSchema,
  normalizeDispatchDriverRule,
  type CompanyDispatchSettings,
} from "@/lib/validations/dispatch-settings";

export function parseDispatchSettings(raw: unknown): CompanyDispatchSettings {
  const stored = (raw ?? {}) as Partial<CompanyDispatchSettings>;
  const merged = {
    ...DEFAULT_DISPATCH_SETTINGS,
    ...stored,
    autoAssignCategories: {
      ...DEFAULT_DISPATCH_SETTINGS.autoAssignCategories,
      ...stored.autoAssignCategories,
    },
    driverRules: (stored.driverRules ?? DEFAULT_DISPATCH_SETTINGS.driverRules).map((rule) =>
      normalizeDispatchDriverRule(rule)
    ),
    zoneDriverMap: stored.zoneDriverMap ?? DEFAULT_DISPATCH_SETTINGS.zoneDriverMap,
  };
  return companyDispatchSettingsSchema.parse(merged);
}

export async function getCompanyDispatchSettings(
  companyId: string
): Promise<CompanyDispatchSettings> {
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { settings: true },
  });
  if (!company) return DEFAULT_DISPATCH_SETTINGS;

  const settings = (company.settings ?? {}) as Record<string, unknown>;
  return parseDispatchSettings(settings.dispatchRules);
}

export async function updateCompanyDispatchSettings(
  companyId: string,
  settings: CompanyDispatchSettings
): Promise<CompanyDispatchSettings> {
  const parsed = companyDispatchSettingsSchema.parse(settings);
  if (parsed.enabled) {
    try {
      const access = await resolveCompanySaasAccess(companyId);
      if (!access.features.has("auto_dispatch")) {
        throw new Error("SAAS_FEATURE_NOT_AVAILABLE");
      }
    } catch (error) {
      if (error instanceof Error && error.message === "SAAS_FEATURE_NOT_AVAILABLE") throw error;
      if (!(error instanceof Error && error.message === "SAAS_SUBSCRIPTION_REQUIRED")) throw error;
    }
  }

  // Réclamation sur updatedAt : les autres clés de settings ne sont jamais écrasées ; deux
  // enregistrements simultanés des règles de dispatch : le second reçoit SETTINGS_CONFLICT.
  const result = await updateCompanySettingsWithClaim(companyId, {
    apply: (current) => ({ ...current, dispatchRules: parsed }),
    section: settingsSection("dispatchRules"),
  });
  if (result === "missing") throw new Error("COMPANY_NOT_FOUND");

  return parsed;
}
