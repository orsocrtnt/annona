import { prisma } from "@/services/prisma/client";
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

export async function getClientSettings(userId: string): Promise<ClientSettings> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { settings: true },
  });
  const stored = (user?.settings ?? {}) as Partial<ClientSettings>;
  return { ...DEFAULT_SETTINGS, ...stored };
}

export async function updateClientSettings(userId: string, input: ClientSettingsInput) {
  const current = await getClientSettings(userId);
  const next = { ...current, ...input };

  await prisma.user.update({
    where: { id: userId },
    data: { settings: next },
  });

  return next;
}
