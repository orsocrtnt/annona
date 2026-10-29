import type { Prisma } from "@prisma/client";
import { settingsSection, updateSettingsWithClaim } from "@/lib/database/claimed-settings-update";
import { prisma } from "@/services/prisma/client";

/** Le client voit le téléphone du livreur tant que l'administrateur ne l'a pas masqué. */
export const DEFAULT_PORTAL_SHOW_DRIVER_PHONE = true;

export function readPortalShowDriverPhone(settings: unknown): boolean {
  const value = settings && typeof settings === "object" && !Array.isArray(settings)
    ? (settings as Record<string, unknown>).portalShowDriverPhone
    : undefined;
  return typeof value === "boolean" ? value : DEFAULT_PORTAL_SHOW_DRIVER_PHONE;
}

export async function getPortalShowDriverPhone(companyId: string): Promise<boolean> {
  const company = await prisma.company.findUnique({ where: { id: companyId }, select: { settings: true } });
  return readPortalShowDriverPhone(company?.settings);
}

export async function updatePortalShowDriverPhone(companyId: string, value: boolean): Promise<boolean> {
  // Réclamation sur updatedAt : les autres clés de Company.settings ne sont jamais écrasées.
  const result = await updateSettingsWithClaim({
    load: () => prisma.company.findUnique({ where: { id: companyId }, select: { settings: true, updatedAt: true } }),
    apply: (current) => ({ ...current, portalShowDriverPhone: value }),
    section: settingsSection("portalShowDriverPhone"),
    save: async (settings, claim) => {
      const claimed = await prisma.company.updateMany({
        where: { id: companyId, updatedAt: claim.expected },
        data: { settings: settings as Prisma.InputJsonValue, updatedAt: claim.next },
      });
      return claimed.count === 1;
    },
  });
  if (result === "missing") throw new Error("COMPANY_NOT_FOUND");
  return value;
}
