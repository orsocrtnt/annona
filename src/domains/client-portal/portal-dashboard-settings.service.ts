import { prisma } from "@/services/prisma/client";
import type { Prisma } from "@prisma/client";
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

export async function updatePortalDashboardLayout(
  userId: string,
  input: PortalDashboardLayoutInput
): Promise<PortalDashboardLayoutSettings> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { settings: true },
  });

  const current = (user?.settings ?? {}) as StoredUserSettings;
  const portal = current.portal ?? {};
  const normalized = normalizePortalDashboardLayout(input);
  const nextSettings: StoredUserSettings = {
    ...current,
    portal: {
      ...portal,
      dashboard: normalized,
    },
  };

  await prisma.user.update({
    where: { id: userId },
    data: { settings: nextSettings as Prisma.InputJsonValue },
  });

  return normalized;
}

export async function resetPortalDashboardLayout(
  userId: string
): Promise<PortalDashboardLayoutSettings> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { settings: true },
  });

  const current = (user?.settings ?? {}) as StoredUserSettings;
  const portal = current.portal ?? {};
  const nextSettings: StoredUserSettings = {
    ...current,
    portal: {
      ...portal,
      dashboard: DEFAULT_PORTAL_DASHBOARD_LAYOUT,
    },
  };

  await prisma.user.update({
    where: { id: userId },
    data: { settings: nextSettings as Prisma.InputJsonValue },
  });

  return DEFAULT_PORTAL_DASHBOARD_LAYOUT;
}
