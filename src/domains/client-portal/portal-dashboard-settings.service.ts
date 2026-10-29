import { settingsSection } from "@/lib/database/claimed-settings-update";
import { updateUserSettingsWithClaim } from "@/lib/database/settings-claims";
import { prisma } from "@/services/prisma/client";
import {
  DEFAULT_PORTAL_DASHBOARD_LAYOUT,
  normalizePortalDashboardLayout,
  type PortalDashboardLayoutSettings,
} from "@/lib/dashboard/portal-dashboard-layout";
import type { PortalDashboardLayoutInput } from "@/lib/validations/portal-dashboard-layout";

type StoredUserSettings = Record<string, unknown> & {
  portal?: {
    dashboard?: Partial<PortalDashboardLayoutSettings>;
  };
};

export async function getPortalDashboardLayout(userId: string): Promise<PortalDashboardLayoutSettings> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { settings: true },
  });

  const settings = (user?.settings ?? {}) as StoredUserSettings;
  return normalizePortalDashboardLayout(settings.portal?.dashboard);
}

/** Disposition enregistrée sous `portal.dashboard`, sans écraser les autres réglages du compte. */
async function savePortalDashboardLayout(userId: string, dashboard: PortalDashboardLayoutSettings): Promise<PortalDashboardLayoutSettings> {
  const result = await updateUserSettingsWithClaim(userId, {
    apply: (current) => {
      const stored = current as StoredUserSettings;
      return { ...stored, portal: { ...(stored.portal ?? {}), dashboard } };
    },
    // Deux enregistrements simultanés de la disposition : le second reçoit SETTINGS_CONFLICT.
    section: settingsSection("portal", "dashboard"),
  });
  if (result === "missing") throw new Error("USER_NOT_FOUND");
  return dashboard;
}

export async function updatePortalDashboardLayout(
  userId: string,
  input: PortalDashboardLayoutInput
): Promise<PortalDashboardLayoutSettings> {
  return savePortalDashboardLayout(userId, normalizePortalDashboardLayout(input));
}

export async function resetPortalDashboardLayout(userId: string): Promise<PortalDashboardLayoutSettings> {
  return savePortalDashboardLayout(userId, DEFAULT_PORTAL_DASHBOARD_LAYOUT);
}
