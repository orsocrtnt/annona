import { ESTIMATION_MAX_SECONDS, ESTIMATION_SPEED_KMH, motionPositionAt, type TrackingMotion } from "@/domains/tracking/tracking.policy";
import { haversineMeters } from "@/lib/maps/navigation-utils";
import { pointAtDistance, projectOnRoute, remainingPath, type LatLng, type RouteTrack } from "@/lib/maps/route-progress";

/** Recalage sur un nouveau signal : le livreur glisse vers le nouveau point au lieu de sauter. */
export const MOTION_BLEND_MS = 800;
/** Un relevé plus éloigné de la route que cet écart impose de recalculer l'itinéraire. */
export const ROAD_REUSE_MAX_OFFSET_METERS = 40;

/** Itinéraire routier vers la cible et distance, sur ce tracé, du dernier relevé. */
export type RoadTrack = { track: RouteTrack; startDistance: number };

const toLatLng = (point: { latitude: number; longitude: number }): LatLng => [point.latitude, point.longitude];
const toPoint = ([latitude, longitude]: LatLng) => ({ latitude, longitude });

/** Distance supposée depuis le dernier relevé : 25 km/h, arrêt après la durée d'estimation. */
export function travelledMeters(motion: TrackingMotion, nowMs: number): number {
  const seconds = Math.min(Math.max(0, (nowMs - Date.parse(motion.since)) / 1000), ESTIMATION_MAX_SECONDS);
  return (seconds * ESTIMATION_SPEED_KMH) / 3.6;
}

/** Position supposée : le long de la route si elle est connue, sinon en ligne droite. */
export function motionPoint(motion: TrackingMotion, road: RoadTrack | null, nowMs: number): LatLng {
  if (!road) return toLatLng(motionPositionAt(motion, nowMs));
  return pointAtDistance(road.track, road.startDistance + travelledMeters(motion, nowMs));
}

/** Route encore à parcourir, commençant au point affiché (la trace derrière disparaît). */
export function motionTrail(motion: TrackingMotion, road: RoadTrack | null, nowMs: number, shown: LatLng): LatLng[] {
  if (!road) return [shown, toLatLng(motion.target)];
  return [shown, ...remainingPath(road.track, road.startDistance + travelledMeters(motion, nowMs)).slice(1)];
}

/** Glissement vers le nouveau point, rapide puis amorti. */
export function blendPoint(from: LatLng, to: LatLng, elapsedMs: number): LatLng {
  const t = Math.min(Math.max(elapsedMs / MOTION_BLEND_MS, 0), 1);
  const eased = 1 - (1 - t) ** 3;
  return [from[0] + (to[0] - from[0]) * eased, from[1] + (to[1] - from[1]) * eased];
}

/**
 * Nouveau relevé : l'itinéraire déjà chargé reste valable s'il mène à la même cible et que le
 * relevé est sur la route ; on repart alors de sa projection, sans nouvel appel d'itinéraire.
 */
export function reuseRoad(road: RoadTrack | null, motion: TrackingMotion): RoadTrack | null {
  if (!road || road.track.points.length < 2) return null;
  const end = road.track.points[road.track.points.length - 1]!;
  if (haversineMeters(toPoint(end), motion.target) > ROAD_REUSE_MAX_OFFSET_METERS) return null;
  const projected = projectOnRoute(road.track, toLatLng(motion.from));
  if (projected.offsetMeters > ROAD_REUSE_MAX_OFFSET_METERS) return null;
  return { track: road.track, startDistance: projected.distance };
}
