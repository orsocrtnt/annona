import { buildRouteTrack, pointAtDistance, projectOnRoute, type LatLng, type RouteTrack } from "@/lib/maps/route-progress";

/**
 * Conduite simulée d'un livreur le long de son itinéraire, partagée par le serveur, les cartes
 * et la démo : mêmes données et même heure donnent exactement la même position.
 * - croisière urbaine, ralentissement dans les virages selon leur courbure ;
 * - freinage et accélération progressifs ;
 * - grands carrefours franchis au ralenti, arrêt au feu simulé quand il est rouge.
 */

/** Itinéraire routier ; `lights` : grands carrefours (au moins quatre branches) sur le trajet. */
export type DriveRoute = { points: LatLng[]; lights: LatLng[] };

export const CRUISE_SPEED_MS = 30 / 3.6;
const ACCELERATION = 1.2; // m/s²
const DECELERATION = 2; // m/s²
const LATERAL_ACCELERATION = 1.8; // m/s² : confort en virage
const MIN_TURN_SPEED_MS = 8 / 3.6;
const INTERSECTION_SPEED_MS = 15 / 3.6;
const INTERSECTION_ZONE_METERS = 10;
const SAMPLE_METERS = 5;
const CURVE_WINDOW_METERS = 10;
const TIME_STEP_SECONDS = 0.25;
/** Feu simulé : cycle d'une minute dont 24 s de rouge ; deux carrefours sur trois en ont un. */
const LIGHT_CYCLE_SECONDS = 60;
const LIGHT_RED_SECONDS = 24;
const STOP_BEFORE_LIGHT_METERS = 3;

export type DrivePlan = { track: RouteTrack; caps: number[]; lights: { distance: number; phase: number }[] };
export type DriveTimeline = { plan: DrivePlan; distances: number[] };

function bearing(a: LatLng, b: LatLng) {
  const scale = Math.cos((a[0] * Math.PI) / 180);
  return Math.atan2(b[0] - a[0], (b[1] - a[1]) * scale);
}

/** Phase du feu, stable pour un carrefour donné (≈ 10 m près) ; null s'il n'a pas de feu. */
export function lightPhase(point: LatLng): number | null {
  const key = `${point[0].toFixed(4)},${point[1].toFixed(4)}`;
  let hash = 2166136261;
  for (let index = 0; index < key.length; index += 1) hash = Math.imul(hash ^ key.charCodeAt(index), 16777619) >>> 0;
  return hash % 3 === 0 ? null : hash % LIGHT_CYCLE_SECONDS;
}

/** Feu rouge à l'instant `atMs` (heure absolue) : identique pour le serveur et les cartes. */
export function isRedLight(phase: number, atMs: number): boolean {
  const second = ((atMs / 1000 + phase) % LIGHT_CYCLE_SECONDS + LIGHT_CYCLE_SECONDS) % LIGHT_CYCLE_SECONDS;
  return second < LIGHT_RED_SECONDS;
}

/** Vitesses permises tous les 5 m : virages, carrefours, arrêt à la cible, freinage anticipé. */
export function buildDrivePlan(route: DriveRoute): DrivePlan {
  const track = buildRouteTrack(route.points);
  const count = Math.max(1, Math.ceil(track.length / SAMPLE_METERS) + 1);
  const caps: number[] = [];
  for (let index = 0; index < count; index += 1) {
    const s = Math.min(index * SAMPLE_METERS, track.length);
    // Virage mesuré seulement avec du tracé des deux côtés (pas de faux virage au départ ni à l'arrivée).
    let turn = 0;
    if (s >= CURVE_WINDOW_METERS && s <= track.length - CURVE_WINDOW_METERS) {
      const here = pointAtDistance(track, s);
      turn = Math.abs(bearing(here, pointAtDistance(track, s + CURVE_WINDOW_METERS)) - bearing(pointAtDistance(track, s - CURVE_WINDOW_METERS), here));
      if (turn > Math.PI) turn = 2 * Math.PI - turn;
    }
    // Rayon du virage approché par l'arc parcouru sur la fenêtre : v = √(a × R).
    const radius = turn > 1e-3 ? CURVE_WINDOW_METERS / turn : Infinity;
    caps.push(Math.min(CRUISE_SPEED_MS, Math.max(MIN_TURN_SPEED_MS, Math.sqrt(LATERAL_ACCELERATION * radius))));
  }
  const lights: DrivePlan["lights"] = [];
  for (const light of route.lights) {
    const projected = projectOnRoute(track, light);
    if (projected.offsetMeters > 15) continue;
    for (let index = 0; index < count; index += 1) {
      if (Math.abs(index * SAMPLE_METERS - projected.distance) <= INTERSECTION_ZONE_METERS) caps[index] = Math.min(caps[index]!, INTERSECTION_SPEED_MS);
    }
    const phase = lightPhase(light);
    if (phase !== null) lights.push({ distance: projected.distance, phase });
  }
  caps[count - 1] = 0;
  // Freinage anticipé : chaque limite est atteignable depuis la précédente.
  for (let index = count - 2; index >= 0; index -= 1) {
    caps[index] = Math.min(caps[index]!, Math.sqrt(caps[index + 1]! ** 2 + 2 * DECELERATION * SAMPLE_METERS));
  }
  lights.sort((a, b) => a.distance - b.distance);
  return { track, caps, lights };
}

/** Vitesse permise en `s`, interpolée entre deux échantillons ; nulle à la cible. */
function capAt(plan: DrivePlan, s: number) {
  if (s >= plan.track.length) return 0;
  const position = Math.max(0, s) / SAMPLE_METERS;
  const index = Math.min(plan.caps.length - 1, Math.floor(position));
  const next = plan.caps[Math.min(index + 1, plan.caps.length - 1)]!;
  // Le dernier échantillon (arrêt) est placé exactement à la cible, même si elle tombe entre deux.
  const span = index + 1 === plan.caps.length - 1 ? (plan.track.length - index * SAMPLE_METERS) / SAMPLE_METERS : 1;
  const ratio = span > 0 ? Math.min(1, (position - index) / span) : 1;
  return plan.caps[index]! + (next - plan.caps[index]!) * ratio;
}

/**
 * Conduite seconde par seconde depuis le début du tracé, à partir de l'heure absolue `startMs`,
 * pendant `durationSeconds` au plus (arrêt ensuite) : distances parcourues tous les 0,25 s.
 */
export function simulateDrive(plan: DrivePlan, startMs: number, durationSeconds: number): DriveTimeline {
  const distances = [0];
  let s = 0;
  let v = capAt(plan, 0);
  const steps = Math.ceil(durationSeconds / TIME_STEP_SECONDS);
  for (let step = 0; step < steps && s < plan.track.length; step += 1) {
    const atMs = startMs + step * TIME_STEP_SECONDS * 1000;
    let allowed = capAt(plan, s);
    let stopLine = Infinity;
    for (const light of plan.lights) {
      const gap = light.distance - STOP_BEFORE_LIGHT_METERS - s;
      if (gap < 0) continue; // ligne de feu franchie : on ne s'arrête plus au milieu du carrefour
      if (gap > (CRUISE_SPEED_MS ** 2) / (2 * DECELERATION) + 10) break;
      if (isRedLight(light.phase, atMs)) {
        allowed = Math.min(allowed, Math.sqrt(2 * DECELERATION * gap));
        stopLine = s + gap;
      }
      break;
    }
    v = v < allowed ? Math.min(allowed, v + ACCELERATION * TIME_STEP_SECONDS) : allowed;
    s = Math.min(plan.track.length, s + v * TIME_STEP_SECONDS);
    // Au rouge, jamais au-delà de la ligne de feu, même avec un pas de temps grossier.
    if (s > stopLine) {
      s = stopLine;
      v = 0;
    }
    distances.push(s);
  }
  return { plan, distances };
}

/** Durée simulée jusqu'à la cible (ou toute la simulation si elle n'est pas atteinte), en secondes. */
export function timelineDuration(timeline: DriveTimeline): number {
  const arrived = timeline.distances.findIndex((distance) => distance >= timeline.plan.track.length - 0.5);
  return (arrived >= 0 ? arrived : timeline.distances.length - 1) * TIME_STEP_SECONDS;
}

/** Distance parcourue après `elapsedSeconds` ; immobile au-delà de la simulation. */
export function distanceAt(timeline: DriveTimeline, elapsedSeconds: number): number {
  const position = Math.max(0, elapsedSeconds) / TIME_STEP_SECONDS;
  const index = Math.floor(position);
  if (index >= timeline.distances.length - 1) return timeline.distances[timeline.distances.length - 1]!;
  const ratio = position - index;
  return timeline.distances[index]! + (timeline.distances[index + 1]! - timeline.distances[index]!) * ratio;
}

export function positionAt(timeline: DriveTimeline, elapsedSeconds: number): LatLng {
  return pointAtDistance(timeline.plan.track, distanceAt(timeline, elapsedSeconds));
}
