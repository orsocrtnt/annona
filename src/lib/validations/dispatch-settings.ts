import { z } from "zod";

export const dispatchDriverStatusSchema = z.enum(["ACTIVE", "PAUSED"]);

export const dispatchDriverCategoriesSchema = z.object({
  STANDARD: z.boolean(),
  COURIER: z.boolean(),
  SPECIAL_MISSION: z.boolean(),
});

export const dispatchDriverRuleSchema = z.object({
  driverId: z.string().min(1, "Livreur requis"),
  priority: z.number().int().min(1, "Priorité minimale : 1"),
  maxActiveDeliveries: z.number().int().min(1).optional(),
  allowedCategories: dispatchDriverCategoriesSchema.default({
    STANDARD: true,
    COURIER: true,
    SPECIAL_MISSION: false,
  }),
  /** Codes postaux couverts saisis manuellement (ex. 75009, 75007, 92). */
  postalCodePrefixes: z.array(z.string()).default([]),
  dispatchStatus: dispatchDriverStatusSchema.default("ACTIVE"),
  /** Capacité du véhicule pour les tournées ; vide = pas de limite de poids. */
  vehicleCapacityKg: z.number().positive().max(100_000).optional(),
  maxActiveByCategory: z
    .object({
      STANDARD: z.number().int().min(1).optional(),
      COURIER: z.number().int().min(1).optional(),
      SPECIAL_MISSION: z.number().int().min(1).optional(),
    })
    .optional(),
});

/** Tournées (DISPATCH-4, C12) : limites appliquées aux propositions. */
export const dispatchRoundSettingsSchema = z.object({
  stopMinutes: z.number().int().min(1).max(60).default(5),
  dayMinutes: z.number().int().min(30).max(1440).default(480),
  maxDeliveries: z.number().int().min(2).max(40).default(12),
});

export const companyDispatchSettingsSchema = z.object({
  maxActiveDeliveriesPerDriver: z
    .number()
    .int()
    .min(1, "Minimum 1 livraison active")
    .default(3),
  allowDriverSelfClaim: z.boolean().default(false),
  driverRules: z.array(dispatchDriverRuleSchema).default([]),
  rounds: dispatchRoundSettingsSchema.default({ stopMinutes: 5, dayMinutes: 480, maxDeliveries: 12 }),
});

export type DispatchDriverStatus = z.infer<typeof dispatchDriverStatusSchema>;
export type DispatchDriverCategories = z.infer<typeof dispatchDriverCategoriesSchema>;
export type DispatchDriverRule = z.infer<typeof dispatchDriverRuleSchema>;
export type CompanyDispatchSettings = z.infer<typeof companyDispatchSettingsSchema>;

export const DEFAULT_DISPATCH_DRIVER_CATEGORIES: DispatchDriverCategories = {
  STANDARD: true,
  COURIER: true,
  SPECIAL_MISSION: false,
};

export const DEFAULT_DISPATCH_SETTINGS: CompanyDispatchSettings = {
  maxActiveDeliveriesPerDriver: 3,
  allowDriverSelfClaim: false,
  driverRules: [],
  rounds: { stopMinutes: 5, dayMinutes: 480, maxDeliveries: 12 },
};

export function normalizeDispatchDriverRule(
  rule: Partial<DispatchDriverRule> & Pick<DispatchDriverRule, "driverId" | "priority">
): DispatchDriverRule {
  return dispatchDriverRuleSchema.parse({
    ...rule,
    allowedCategories: {
      ...DEFAULT_DISPATCH_DRIVER_CATEGORIES,
      ...rule.allowedCategories,
    },
    postalCodePrefixes: rule.postalCodePrefixes ?? [],
    dispatchStatus: rule.dispatchStatus ?? "ACTIVE",
  });
}

export function getDispatchDriverRule(
  settings: CompanyDispatchSettings,
  driverId: string
): DispatchDriverRule | null {
  const rule = settings.driverRules.find((item) => item.driverId === driverId);
  return rule ? normalizeDispatchDriverRule(rule) : null;
}

export function getDriverCategoryLabels(rule: DispatchDriverRule | null): string[] {
  const allowed = rule?.allowedCategories ?? DEFAULT_DISPATCH_DRIVER_CATEGORIES;
  const labels: string[] = [];
  if (allowed.STANDARD) labels.push("Commandes");
  if (allowed.COURIER) labels.push("Courses");
  if (allowed.SPECIAL_MISSION) labels.push("Missions");
  return labels;
}
