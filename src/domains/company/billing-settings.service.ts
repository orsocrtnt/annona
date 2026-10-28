import type { Prisma } from "@prisma/client";
import { updateSettingsWithClaim } from "@/lib/database/claimed-settings-update";
import { prisma } from "@/services/prisma/client";
import type { CompanyBillingSettings } from "@/lib/validations/billing-settings";
import {
  DEFAULT_BILLING_SETTINGS,
  DEFAULT_COURIER_PRICING,
  DEFAULT_INVOICE_GENERAL,
} from "@/lib/validations/billing-settings";

function parseBillingSettings(raw: unknown): CompanyBillingSettings {
  const stored = (raw ?? {}) as Partial<CompanyBillingSettings>;
  return {
    courier: { ...DEFAULT_COURIER_PRICING, ...stored.courier },
    invoice: { ...DEFAULT_INVOICE_GENERAL, ...stored.invoice },
  };
}

export async function getCompanyBillingSettings(
  companyId: string
): Promise<CompanyBillingSettings> {
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { settings: true },
  });
  if (!company) return DEFAULT_BILLING_SETTINGS;

  const settings = (company.settings ?? {}) as Record<string, unknown>;
  return parseBillingSettings(settings.billing);
}

export async function updateCompanyBillingSettings(
  companyId: string,
  billing: CompanyBillingSettings
): Promise<CompanyBillingSettings> {
  // Réclamation sur updatedAt : n'écrase jamais une écriture concurrente d'une autre clé (einvoicing…).
  const result = await updateSettingsWithClaim({
    load: () => prisma.company.findUnique({ where: { id: companyId }, select: { settings: true, updatedAt: true } }),
    apply: (current) => ({ ...current, billing }),
    save: async (settings, claim) => {
      const claimed = await prisma.company.updateMany({
        where: { id: companyId, updatedAt: claim.expected },
        data: { settings: settings as Prisma.InputJsonValue, updatedAt: claim.next },
      });
      return claimed.count === 1;
    },
  });
  if (result === "missing") throw new Error("COMPANY_NOT_FOUND");

  return billing;
}
