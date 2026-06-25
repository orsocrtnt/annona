import { z } from "zod";

export const driverLocationSettingsSchema = z.object({
  /** Fréquence d'envoi GPS quand le chauffeur a une mission active */
  activeMissionIntervalSeconds: z
    .number()
    .int()
    .min(2, "Minimum 2 secondes")
    .max(60, "Maximum 60 secondes")
    .default(5),
  /** Fréquence d'envoi GPS quand le chauffeur est en ligne sans mission */
  idleIntervalSeconds: z
    .number()
    .int()
    .min(5, "Minimum 5 secondes")
    .max(120, "Maximum 120 secondes")
    .default(15),
  /** Rafraîchissement de la carte admin (positions chauffeurs) */
  adminMapRefreshSeconds: z
    .number()
    .int()
    .min(2, "Minimum 2 secondes")
    .max(60, "Maximum 60 secondes")
    .default(5),
  /** Délai sans signal avant de marquer un chauffeur hors ligne */
  onlineThresholdSeconds: z
    .number()
    .int()
    .min(10, "Minimum 10 secondes")
    .max(180, "Maximum 180 secondes")
    .default(45),
});

export type DriverLocationSettings = z.infer<typeof driverLocationSettingsSchema>;

export const DEFAULT_DRIVER_LOCATION_SETTINGS: DriverLocationSettings = {
  activeMissionIntervalSeconds: 5,
  idleIntervalSeconds: 15,
  adminMapRefreshSeconds: 5,
  onlineThresholdSeconds: 45,
};
