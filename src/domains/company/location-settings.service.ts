import { prisma } from "@/services/prisma/client";
import {
  DEFAULT_DRIVER_LOCATION_SETTINGS,
  driverLocationSettingsSchema,
  type DriverLocationSettings,
} from "@/lib/validations/driver-location-settings";

function parseLocationSettings(raw: unknown): DriverLocationSettings {
  const stored = (raw ?? {}) as Partial<DriverLocationSettings>;
  return driverLocationSettingsSchema.parse({
    ...DEFAULT_DRIVER_LOCATION_SETTINGS,
    ...stored,
  });
}

export async function getCompanyLocationSettings(
  companyId: string
): Promise<DriverLocationSettings> {
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { settings: true },
  });
  if (!company) return DEFAULT_DRIVER_LOCATION_SETTINGS;

  const settings = (company.settings ?? {}) as Record<string, unknown>;
  return parseLocationSettings(settings.locationTracking);
}

export async function updateCompanyLocationSettings(
  companyId: string,
  settings: DriverLocationSettings
): Promise<DriverLocationSettings> {
  const parsed = driverLocationSettingsSchema.parse(settings);

  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { settings: true },
  });
  if (!company) throw new Error("COMPANY_NOT_FOUND");

  const current = (company.settings ?? {}) as Record<string, unknown>;
  const nextSettings = {
    ...current,
    locationTracking: parsed,
  };

  await prisma.company.update({
    where: { id: companyId },
    data: { settings: nextSettings },
  });

  return parsed;
}
