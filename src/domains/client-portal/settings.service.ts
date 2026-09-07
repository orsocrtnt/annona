import { prisma } from "@/services/prisma/client";
import { Prisma } from "@prisma/client";
import type { ClientSettingsInput } from "@/lib/validations/settings";

export interface ClientSettings {
  emailNotifications: boolean;
  smsNotifications: boolean;
  deliveryAlerts: boolean;
  invoiceAlerts: boolean;
}

const DEFAULT_SETTINGS: ClientSettings = {
  emailNotifications: true,
  smsNotifications: false,
  deliveryAlerts: true,
  invoiceAlerts: true,
};

function asBoolean(value: unknown, fallback: boolean) {
  return typeof value === "boolean" ? value : fallback;
}

export async function getClientSettings(userId: string): Promise<ClientSettings> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { settings: true },
  });
  const stored =
    user?.settings && typeof user.settings === "object" && !Array.isArray(user.settings)
      ? (user.settings as Record<string, unknown>)
      : {};

  return {
    emailNotifications: asBoolean(stored.emailNotifications, DEFAULT_SETTINGS.emailNotifications),
    smsNotifications: false,
    deliveryAlerts: asBoolean(stored.deliveryAlerts, DEFAULT_SETTINGS.deliveryAlerts),
    invoiceAlerts: asBoolean(stored.invoiceAlerts, DEFAULT_SETTINGS.invoiceAlerts),
  };
}

export async function updateClientSettings(userId: string, input: ClientSettingsInput) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { settings: true },
  });
  const stored =
    user?.settings && typeof user.settings === "object" && !Array.isArray(user.settings)
      ? { ...(user.settings as Record<string, unknown>) }
      : {};
  const current = await getClientSettings(userId);
  const nextPrefs: ClientSettings = {
    ...current,
    ...input,
    smsNotifications: false,
  };

  await prisma.user.update({
    where: { id: userId },
    data: { settings: { ...stored, ...nextPrefs } as Prisma.InputJsonValue },
  });

  return nextPrefs;
}
