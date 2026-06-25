import { prisma } from "@/services/prisma/client";
import type { Prisma } from "@prisma/client";
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

export async function updateDashboardLayout(
  userId: string,
  input: DashboardLayoutInput
): Promise<DashboardLayoutSettings> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { settings: true },
  });

  const current = (user?.settings ?? {}) as StoredUserSettings;
  const backOffice = current.backOffice ?? {};
  const nextSettings: StoredUserSettings = {
    ...current,
    backOffice: {
      ...backOffice,
      dashboard: normalizeDashboardLayout(input),
    },
  };

  await prisma.user.update({
    where: { id: userId },
    data: { settings: nextSettings as Prisma.InputJsonValue },
  });

  return normalizeDashboardLayout(input);
}

export async function resetDashboardLayout(userId: string): Promise<DashboardLayoutSettings> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { settings: true },
  });

  const current = (user?.settings ?? {}) as StoredUserSettings;
  const backOffice = current.backOffice ?? {};
  const nextSettings: StoredUserSettings = {
    ...current,
    backOffice: {
      ...backOffice,
      dashboard: DEFAULT_DASHBOARD_LAYOUT,
    },
  };

  await prisma.user.update({
    where: { id: userId },
    data: { settings: nextSettings as Prisma.InputJsonValue },
  });

  return DEFAULT_DASHBOARD_LAYOUT;
}
