import { settingsSection } from "@/lib/database/claimed-settings-update";
import { updateCompanySettingsWithClaim } from "@/lib/database/settings-claims";
import { prisma } from "@/services/prisma/client";
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
    driverRules: (stored.driverRules ?? DEFAULT_DISPATCH_SETTINGS.driverRules).map((rule) =>
      normalizeDispatchDriverRule(rule)
    ),
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
  // Réclamation sur updatedAt : les autres clés de settings ne sont jamais écrasées ; deux
  // enregistrements simultanés des règles de dispatch : le second reçoit SETTINGS_CONFLICT.
  const result = await updateCompanySettingsWithClaim(companyId, {
    apply: (current) => ({ ...current, dispatchRules: parsed }),
    section: settingsSection("dispatchRules"),
  });
  if (result === "missing") throw new Error("COMPANY_NOT_FOUND");

  return parsed;
}
