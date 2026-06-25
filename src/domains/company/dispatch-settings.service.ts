import type { Prisma } from "@prisma/client";
import { prisma } from "@/services/prisma/client";
import {
  DEFAULT_DISPATCH_SETTINGS,
  companyDispatchSettingsSchema,
  normalizeDispatchDriverRule,
  type CompanyDispatchSettings,
} from "@/lib/validations/dispatch-settings";

function parseDispatchSettings(raw: unknown): CompanyDispatchSettings {
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

  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { settings: true },
  });
  if (!company) throw new Error("COMPANY_NOT_FOUND");

  const current = (company.settings ?? {}) as Record<string, unknown>;
  const nextSettings = {
    ...current,
    dispatchRules: parsed,
  };

  await prisma.company.update({
    where: { id: companyId },
    data: { settings: nextSettings as Prisma.InputJsonValue },
  });

  return parsed;
}
