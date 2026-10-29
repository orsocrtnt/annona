import type { Prisma } from "@prisma/client";
import { updateSettingsWithClaim } from "@/lib/database/claimed-settings-update";
import { prisma } from "@/services/prisma/client";

/**
 * Écritures réclamées des JSON `settings` de Company et de User (RECETTE-2810, point 16).
 * Toute écriture de `settings` passe par ici (ou par `updateSettingsWithClaim` directement) :
 * relecture, modification sur la version lue, écriture conditionnée à `updatedAt`.
 * Lève SETTINGS_CONFLICT si la version change à chaque tentative, ou si `section` a été modifiée
 * par un autre enregistrement pendant la tentative.
 */
type ClaimOptions = {
  apply: (current: Record<string, unknown>) => Record<string, unknown>;
  section?: (current: Record<string, unknown>) => unknown;
};

export function updateCompanySettingsWithClaim(companyId: string, options: ClaimOptions) {
  return updateSettingsWithClaim({
    ...options,
    load: () => prisma.company.findUnique({ where: { id: companyId }, select: { settings: true, updatedAt: true } }),
    save: async (settings, claim) => {
      const claimed = await prisma.company.updateMany({
        where: { id: companyId, updatedAt: claim.expected },
        data: { settings: settings as Prisma.InputJsonValue, updatedAt: claim.next },
      });
      return claimed.count === 1;
    },
  });
}

/** `companyId` : borne l'écriture à l'entreprise (ex. mini-admin modifié par un administrateur). */
export function updateUserSettingsWithClaim(userId: string, options: ClaimOptions & { companyId?: string }) {
  const scope = options.companyId ? { companyId: options.companyId } : {};
  return updateSettingsWithClaim({
    apply: options.apply,
    section: options.section,
    load: () => prisma.user.findFirst({ where: { id: userId, ...scope }, select: { settings: true, updatedAt: true } }),
    save: async (settings, claim) => {
      const claimed = await prisma.user.updateMany({
        where: { id: userId, ...scope, updatedAt: claim.expected },
        data: { settings: settings as Prisma.InputJsonValue, updatedAt: claim.next },
      });
      return claimed.count === 1;
    },
  });
}
