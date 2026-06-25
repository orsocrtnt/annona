import type { Prisma } from "@prisma/client";
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
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { settings: true },
  });
  if (!company) throw new Error("COMPANY_NOT_FOUND");

  const current = (company.settings ?? {}) as Record<string, unknown>;
  const nextSettings = {
    ...current,
    billing,
  };

  await prisma.company.update({
    where: { id: companyId },
    data: { settings: nextSettings as Prisma.InputJsonValue },
  });

  return billing;
}
