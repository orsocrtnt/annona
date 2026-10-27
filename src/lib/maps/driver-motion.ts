import { ESTIMATION_MAX_SECONDS, type TrackingMotion } from "@/domains/tracking/tracking.policy";
import { distanceAt, positionAt, type DriveTimeline } from "@/lib/maps/drive-simulation";
import { remainingPath, type LatLng } from "@/lib/maps/route-progress";

/** Recalage sur un nouveau signal : le livreur glisse vers le nouveau point au lieu de sauter. */
export const MOTION_BLEND_MS = 800;

const elapsedSeconds = (motion: TrackingMotion, nowMs: number) => (nowMs - Date.parse(motion.since)) / 1000;

/** Position supposée : conduite simulée le long de la route ; sans route, le dernier relevé. */
export function motionPoint(motion: TrackingMotion, timeline: DriveTimeline | null, nowMs: number): LatLng {
  if (!timeline) return [motion.from.latitude, motion.from.longitude];
  return positionAt(timeline, elapsedSeconds(motion, nowMs));
}

/** Route encore à parcourir, commençant au point affiché (la trace derrière disparaît). */
export function motionTrail(motion: TrackingMotion, timeline: DriveTimeline | null, nowMs: number, shown: LatLng): LatLng[] {
  if (!timeline) return [];
  return [shown, ...remainingPath(timeline.plan.track, distanceAt(timeline, elapsedSeconds(motion, nowMs))).slice(1)];
}

/** Le livreur ne bougera plus : signal perdu (durée d'estimation passée) ou cible atteinte. */
export function motionSettled(motion: TrackingMotion, timeline: DriveTimeline | null, nowMs: number): boolean {
  if (!timeline) return true;
  const elapsed = elapsedSeconds(motion, nowMs);
  return elapsed >= ESTIMATION_MAX_SECONDS || distanceAt(timeline, elapsed) >= timeline.plan.track.length;
}

/** Glissement vers le nouveau point, rapide puis amorti. */
export function blendPoint(from: LatLng, to: LatLng, elapsedMs: number): LatLng {
  const t = Math.min(Math.max(elapsedMs / MOTION_BLEND_MS, 0), 1);
  const eased = 1 - (1 - t) ** 3;
  return [from[0] + (to[0] - from[0]) * eased, from[1] + (to[1] - from[1]) * eased];
}
