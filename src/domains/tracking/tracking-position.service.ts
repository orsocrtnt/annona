import { getDriveRoute } from "@/domains/tracking/drive-route.service";
import { trackingPosition, type TrackingPoint, type TrackingPosition } from "@/domains/tracking/tracking.policy";

type PositionArgs = Parameters<typeof trackingPosition>;

/**
 * Position de suivi avec l'itinéraire routier du livreur (en mémoire, ou calculé dans le budget
 * d'attente). Sans itinéraire prêt, le livreur reste à son dernier point jusqu'à la lecture suivante.
 */
export async function resolveTrackingPosition(
  driverId: string | null,
  mission: PositionArgs[0],
  driver: PositionArgs[1],
  thresholdSeconds: number,
  now: Date,
  target: TrackingPoint | null
): Promise<TrackingPosition> {
  const base = trackingPosition(mission, driver, thresholdSeconds, now, target);
  if (!base.motion || !driverId) return base;
  const route = await getDriveRoute(driverId, base.motion.from, base.motion.target);
  return route ? trackingPosition(mission, driver, thresholdSeconds, now, target, route) : base;
}
