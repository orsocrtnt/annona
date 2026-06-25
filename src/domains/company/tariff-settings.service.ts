import { prisma } from "@/services/prisma/client";
import type { CompanyTariffSettings } from "@/lib/validations/tariff-settings";
import { findTariffZoneForPostalCode } from "@/lib/tariff/find-tariff-zone";

export { findTariffZoneForPostalCode };

export const DEFAULT_TARIFF_SETTINGS: CompanyTariffSettings = {
  tariffZones: [],
  tariffFees: [],
};

function parseTariffSettings(raw: unknown): CompanyTariffSettings {
  const stored = (raw ?? {}) as Partial<CompanyTariffSettings>;
  return {
    tariffZones: stored.tariffZones ?? DEFAULT_TARIFF_SETTINGS.tariffZones,
    tariffFees: stored.tariffFees ?? DEFAULT_TARIFF_SETTINGS.tariffFees,
  };
}

export async function getCompanyTariffSettings(
  companyId: string
): Promise<CompanyTariffSettings> {
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { settings: true },
  });
  if (!company) return DEFAULT_TARIFF_SETTINGS;
  return parseTariffSettings(company.settings);
}

export async function updateCompanyTariffSettings(
  companyId: string,
  settings: CompanyTariffSettings
): Promise<CompanyTariffSettings> {
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { settings: true },
  });
  if (!company) throw new Error("COMPANY_NOT_FOUND");

  const current = (company.settings ?? {}) as Record<string, unknown>;
  const nextSettings = {
    ...current,
    tariffZones: settings.tariffZones,
    tariffFees: settings.tariffFees,
  };

  await prisma.company.update({
    where: { id: companyId },
    data: { settings: nextSettings },
  });

  return settings;
}

// Réexport pour compatibilité — implémentation pure dans @/lib/tariff/find-tariff-zone
