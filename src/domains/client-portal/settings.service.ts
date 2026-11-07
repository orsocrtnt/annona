import { settingsKeys } from "@/lib/database/claimed-settings-update";
import { updateUserSettingsWithClaim } from "@/lib/database/settings-claims";
import { prisma } from "@/services/prisma/client";
import type { ClientSettingsInput } from "@/lib/validations/settings";

export interface ClientSettings {
  emailNotifications: boolean;
  smsNotifications: boolean;
  deliveryAlerts: boolean;
  invoiceAlerts: boolean;
  /** NOT-01 : rappel avant l'heure limite (seule notification de commande que le client peut couper). */
  orderReminders: boolean;
}

const DEFAULT_SETTINGS: ClientSettings = {
  emailNotifications: true,
  smsNotifications: false,
  deliveryAlerts: true,
  invoiceAlerts: true,
  orderReminders: true,
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
  return readClientSettings(stored);
}

export function readClientSettings(stored: Record<string, unknown>): ClientSettings {
  return {
    emailNotifications: asBoolean(stored.emailNotifications, DEFAULT_SETTINGS.emailNotifications),
    smsNotifications: false,
    deliveryAlerts: asBoolean(stored.deliveryAlerts, DEFAULT_SETTINGS.deliveryAlerts),
    invoiceAlerts: asBoolean(stored.invoiceAlerts, DEFAULT_SETTINGS.invoiceAlerts),
    orderReminders: asBoolean(stored.orderReminders, DEFAULT_SETTINGS.orderReminders),
  };
}

const CLIENT_PREFERENCE_KEYS = ["emailNotifications", "smsNotifications", "deliveryAlerts", "invoiceAlerts", "orderReminders"] as const;

export async function updateClientSettings(userId: string, input: ClientSettingsInput) {
  let nextPrefs: ClientSettings | null = null;
  // Préférences fusionnées sur la version relue (réclamation sur updatedAt) : les autres clés du
  // compte ne sont jamais écrasées ; deux enregistrements simultanés : SETTINGS_CONFLICT au second.
  const result = await updateUserSettingsWithClaim(userId, {
    apply: (stored) => {
      nextPrefs = { ...readClientSettings(stored), ...input, smsNotifications: false };
      return { ...stored, ...nextPrefs };
    },
    section: settingsKeys(...CLIENT_PREFERENCE_KEYS),
  });
  if (result === "missing" || !nextPrefs) throw new Error("USER_NOT_FOUND");
  return nextPrefs as ClientSettings;
}
