import { settingsSection } from "@/lib/database/claimed-settings-update";
import { updateCompanySettingsWithClaim } from "@/lib/database/settings-claims";
import { prisma } from "@/services/prisma/client";
import type { DeliveryCategory } from "@prisma/client";
import type { CompanyDeliveryOptions } from "@/lib/validations/company-settings";
import { DEFAULT_DELIVERY_SLOTS, parseDeliverySlots, type CompanyDeliverySlots } from "@/lib/validations/delivery-slots";

export const DEFAULT_DELIVERY_OPTIONS: CompanyDeliveryOptions = {
  deliveryCategories: {
    STANDARD: true,
    COURIER: true,
    SPECIAL_MISSION: false,
  },
};

const ALL_CATEGORIES: DeliveryCategory[] = ["STANDARD", "COURIER", "SPECIAL_MISSION"];

function parseCompanySettings(raw: unknown): CompanyDeliveryOptions {
  const stored = (raw ?? {}) as Partial<CompanyDeliveryOptions>;
  return {
    deliveryCategories: {
      STANDARD:
        stored.deliveryCategories?.STANDARD ??
        DEFAULT_DELIVERY_OPTIONS.deliveryCategories.STANDARD,
      COURIER:
        stored.deliveryCategories?.COURIER ??
        DEFAULT_DELIVERY_OPTIONS.deliveryCategories.COURIER,
      SPECIAL_MISSION:
        stored.deliveryCategories?.SPECIAL_MISSION ??
        DEFAULT_DELIVERY_OPTIONS.deliveryCategories.SPECIAL_MISSION,
    },
  };
}

export async function getCompanyDeliveryOptions(companyId: string): Promise<CompanyDeliveryOptions> {
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { settings: true },
  });
  if (!company) return DEFAULT_DELIVERY_OPTIONS;
  return parseCompanySettings(company.settings);
}

export async function updateCompanyDeliveryOptions(
  companyId: string,
  options: CompanyDeliveryOptions
): Promise<CompanyDeliveryOptions> {
  const result = await updateCompanySettingsWithClaim(companyId, {
    apply: (current) => ({ ...current, deliveryCategories: options.deliveryCategories }),
    section: settingsSection("deliveryCategories"),
  });
  if (result === "missing") throw new Error("COMPANY_NOT_FOUND");

  return options;
}

export async function getCompanyDeliverySlots(companyId: string): Promise<CompanyDeliverySlots> {
  const company = await prisma.company.findUnique({ where: { id: companyId }, select: { settings: true } });
  if (!company) return DEFAULT_DELIVERY_SLOTS;
  return parseDeliverySlots((company.settings as Record<string, unknown> | null)?.deliverySlots);
}

export async function updateCompanyDeliverySlots(companyId: string, slots: CompanyDeliverySlots): Promise<CompanyDeliverySlots> {
  // Réclamation sur updatedAt : les autres clés de Company.settings ne sont jamais écrasées.
  const result = await updateCompanySettingsWithClaim(companyId, {
    apply: (current) => ({ ...current, deliverySlots: slots }),
    section: settingsSection("deliverySlots"),
  });
  if (result === "missing") throw new Error("COMPANY_NOT_FOUND");
  return parseDeliverySlots(slots);
}

export function getEnabledDeliveryCategories(options: CompanyDeliveryOptions): DeliveryCategory[] {
  return ALL_CATEGORIES.filter((cat) => options.deliveryCategories[cat]);
}

export async function assertDeliveryCategoryEnabled(
  companyId: string,
  category: DeliveryCategory
): Promise<void> {
  const options = await getCompanyDeliveryOptions(companyId);
  if (!options.deliveryCategories[category]) {
    throw new Error("DELIVERY_CATEGORY_DISABLED");
  }
}
