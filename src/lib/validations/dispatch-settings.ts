import { z } from "zod";

export const dispatchStrategySchema = z.enum([
  "PRIORITY_LIST",
  "LEAST_LOADED",
  "ZONE_THEN_PRIORITY",
]);

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
  zoneIds: z.array(z.string()).default([]),
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
  /** Vrai avec l'affectation automatique : les tournées sont affectées sans validation. */
  autoAssign: z.boolean().default(false),
  stopMinutes: z.number().int().min(1).max(60).default(5),
  dayMinutes: z.number().int().min(30).max(1440).default(480),
  maxDeliveries: z.number().int().min(2).max(40).default(12),
});

export const companyDispatchSettingsSchema = z.object({
  enabled: z.boolean(),
  strategy: dispatchStrategySchema,
  maxActiveDeliveriesPerDriver: z
    .number()
    .int()
    .min(1, "Minimum 1 livraison active")
    .default(3),
  prioritizeCourier: z.boolean().default(true),
  autoAssignCategories: z.object({
    STANDARD: z.boolean(),
    COURIER: z.boolean(),
    SPECIAL_MISSION: z.boolean(),
  }),
  allowDriverSelfClaim: z.boolean().default(false),
  driverRules: z.array(dispatchDriverRuleSchema).default([]),
  zoneDriverMap: z.record(z.string(), z.string()).default({}),
  defaultDriverId: z.string().nullable().optional(),
  /**
   * DEMO-3 : la distance au retrait n'est qu'un départage, en dernier critère avant l'ordre
   * stable (priorité réglée, zone et charge restent devant). Actif par défaut : seules les
   * égalités changent d'issue.
   */
  gpsProximityEnabled: z.boolean().default(true),
  /**
   * DISPATCH-4 : affectation automatique au meilleur score (trajet, charge, zone, priorité ;
   * voir `dispatch-score.ts`). Champ séparé de `strategy` pour un retour arrière sûr : l'ancien
   * code ignore ce champ (clé inconnue retirée par zod) et reprend la stratégie enregistrée.
   */
  bestScore: z.boolean().default(false),
  rounds: dispatchRoundSettingsSchema.default({ autoAssign: false, stopMinutes: 5, dayMinutes: 480, maxDeliveries: 12 }),
  /** Au-delà, la position du livreur est jugée périmée et n'est pas utilisée. */
  gpsPositionMaxAgeMinutes: z
    .number()
    .int()
    .min(1, "Minimum 1 minute")
    .max(120, "Maximum 120 minutes")
    .default(15),
  /** Au-delà, un livreur n'est pas considéré comme proche du point de retrait. */
  gpsMaxDistanceKm: z
    .number()
    .min(1, "Minimum 1 km")
    .max(100, "Maximum 100 km")
    .default(10),
});

export type GpsNumericSetting = "gpsPositionMaxAgeMinutes" | "gpsMaxDistanceKm";

const GPS_INPUT_RULES: Record<GpsNumericSetting, { min: number; max: number; step: number }> = {
  gpsPositionMaxAgeMinutes: { min: 1, max: 120, step: 1 },
  gpsMaxDistanceKm: { min: 1, max: 100, step: 0.1 },
};

/** Saisie libre validée au blur : bornée, arrondie au pas ; `null` garde la valeur précédente. */
export function parseGpsSettingInput(field: GpsNumericSetting, raw: string): number | null {
  const text = raw.trim().replace(",", ".");
  const value = Number(text);
  if (!text || !Number.isFinite(value)) return null;
  const { min, max, step } = GPS_INPUT_RULES[field];
  const rounded = Number((Math.round(value / step) * step).toFixed(1));
  return Math.min(max, Math.max(min, rounded));
}

export type DispatchStrategy = z.infer<typeof dispatchStrategySchema>;
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
  enabled: false,
  strategy: "PRIORITY_LIST",
  maxActiveDeliveriesPerDriver: 3,
  prioritizeCourier: true,
  autoAssignCategories: {
    STANDARD: true,
    COURIER: true,
    SPECIAL_MISSION: false,
  },
  allowDriverSelfClaim: false,
  driverRules: [],
  zoneDriverMap: {},
  defaultDriverId: null,
  rounds: { autoAssign: false, stopMinutes: 5, dayMinutes: 480, maxDeliveries: 12 },
  gpsProximityEnabled: true,
  gpsPositionMaxAgeMinutes: 15,
  gpsMaxDistanceKm: 10,
  bestScore: false,
};

export const DISPATCH_STRATEGY_LABELS: Record<DispatchStrategy, string> = {
  PRIORITY_LIST: "Liste de priorité",
  LEAST_LOADED: "Moins chargé",
  ZONE_THEN_PRIORITY: "Zone puis priorité",
};

/** Libellé de l'option « meilleur score » dans le sélecteur de stratégie (champ `bestScore`). */
export const BEST_SCORE_STRATEGY_LABEL = "Meilleur score (recommandé)";

export function normalizeDispatchDriverRule(
  rule: Partial<DispatchDriverRule> & Pick<DispatchDriverRule, "driverId" | "priority">
): DispatchDriverRule {
  return dispatchDriverRuleSchema.parse({
    ...rule,
    allowedCategories: {
      ...DEFAULT_DISPATCH_DRIVER_CATEGORIES,
      ...rule.allowedCategories,
    },
    zoneIds: rule.zoneIds ?? [],
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
