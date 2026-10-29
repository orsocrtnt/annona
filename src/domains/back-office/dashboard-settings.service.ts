import { settingsSection } from "@/lib/database/claimed-settings-update";
import { updateUserSettingsWithClaim } from "@/lib/database/settings-claims";
import { prisma } from "@/services/prisma/client";
import {
  DEFAULT_DASHBOARD_LAYOUT,
  normalizeDashboardLayout,
  type DashboardLayoutSettings,
} from "@/lib/dashboard/dashboard-layout";
import type { DashboardLayoutInput } from "@/lib/validations/dashboard-layout";

type StoredUserSettings = Record<string, unknown> & {
  backOffice?: {
    dashboard?: Partial<DashboardLayoutSettings>;
  };
};

export async function getDashboardLayout(userId: string): Promise<DashboardLayoutSettings> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { settings: true },
  });

  const settings = (user?.settings ?? {}) as StoredUserSettings;
  return normalizeDashboardLayout(settings.backOffice?.dashboard);
}

/** Disposition enregistrée sous `backOffice.dashboard`, sans écraser les autres réglages du compte. */
async function saveDashboardLayout(userId: string, dashboard: DashboardLayoutSettings): Promise<DashboardLayoutSettings> {
  const result = await updateUserSettingsWithClaim(userId, {
    apply: (current) => {
      const stored = current as StoredUserSettings;
      return { ...stored, backOffice: { ...(stored.backOffice ?? {}), dashboard } };
    },
    // Deux enregistrements simultanés de la disposition : le second reçoit SETTINGS_CONFLICT.
    section: settingsSection("backOffice", "dashboard"),
  });
  if (result === "missing") throw new Error("USER_NOT_FOUND");
  return dashboard;
}

export async function updateDashboardLayout(
  userId: string,
  input: DashboardLayoutInput
): Promise<DashboardLayoutSettings> {
  return saveDashboardLayout(userId, normalizeDashboardLayout(input));
}

export async function resetDashboardLayout(userId: string): Promise<DashboardLayoutSettings> {
  return saveDashboardLayout(userId, DEFAULT_DASHBOARD_LAYOUT);
}
