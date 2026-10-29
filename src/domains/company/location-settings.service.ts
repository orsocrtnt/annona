import { settingsSection } from "@/lib/database/claimed-settings-update";
import { updateCompanySettingsWithClaim } from "@/lib/database/settings-claims";
import { prisma } from "@/services/prisma/client";
import {
  DEFAULT_DRIVER_LOCATION_SETTINGS,
  driverLocationSettingsSchema,
  type DriverLocationSettings,
} from "@/lib/validations/driver-location-settings";

export function parseLocationSettings(raw: unknown): DriverLocationSettings {
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

  const result = await updateCompanySettingsWithClaim(companyId, {
    apply: (current) => ({ ...current, locationTracking: parsed }),
    section: settingsSection("locationTracking"),
  });
  if (result === "missing") throw new Error("COMPANY_NOT_FOUND");

  return parsed;
}
