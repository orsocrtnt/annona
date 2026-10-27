import { haversineMeters } from "@/lib/maps/navigation-utils";

/** Point [latitude, longitude], comme les tracés Leaflet et OSRM de l'application. */
export type LatLng = [number, number];

/** Tracé routier mesuré : distances cumulées en mètres depuis le premier point. */
export type RouteTrack = { points: LatLng[]; cumulative: number[]; length: number };

const toPoint = ([latitude, longitude]: LatLng) => ({ latitude, longitude });

export function buildRouteTrack(points: LatLng[]): RouteTrack {
  const cumulative = [0];
  for (let index = 1; index < points.length; index += 1) {
    cumulative.push(cumulative[index - 1]! + haversineMeters(toPoint(points[index - 1]!), toPoint(points[index]!)));
  }
  return { points, cumulative, length: cumulative[cumulative.length - 1] ?? 0 };
}

/** Segment qui contient la distance `meters` (bornée au tracé) et avancement dans ce segment. */
function locate(track: RouteTrack, meters: number) {
  const distance = Math.min(Math.max(meters, 0), track.length);
  let index = 0;
  while (index < track.points.length - 2 && track.cumulative[index + 1]! < distance) index += 1;
  const segment = track.cumulative[index + 1]! - track.cumulative[index]!;
  return { index, ratio: segment > 0 ? (distance - track.cumulative[index]!) / segment : 0 };
}

/** Point situé à `meters` du départ, le long de la route ; reste au départ ou à l'arrivée au-delà. */
export function pointAtDistance(track: RouteTrack, meters: number): LatLng {
  if (track.points.length === 1) return track.points[0]!;
  const { index, ratio } = locate(track, meters);
  const from = track.points[index]!;
  const to = track.points[index + 1]!;
  return [from[0] + (to[0] - from[0]) * ratio, from[1] + (to[1] - from[1]) * ratio];
}

/** Route encore à parcourir depuis `meters` : la trace derrière le livreur disparaît. */
export function remainingPath(track: RouteTrack, meters: number): LatLng[] {
  if (track.points.length < 2) return [...track.points];
  const { index } = locate(track, meters);
  return [pointAtDistance(track, meters), ...track.points.slice(index + 1)];
}

/**
 * Projection d'un relevé sur la route : distance parcourue au point le plus proche et écart
 * en mètres. Projection locale plane, suffisante à l'échelle d'une ville.
 */
export function projectOnRoute(track: RouteTrack, point: LatLng): { distance: number; offsetMeters: number } {
  if (track.points.length < 2) {
    return { distance: 0, offsetMeters: track.points[0] ? haversineMeters(toPoint(track.points[0]), toPoint(point)) : Infinity };
  }
  const scale = Math.cos((point[0] * Math.PI) / 180);
  let best = { distance: 0, offsetMeters: Infinity };
  for (let index = 0; index < track.points.length - 1; index += 1) {
    const a = track.points[index]!;
    const b = track.points[index + 1]!;
    const dx = (b[1] - a[1]) * scale;
    const dy = b[0] - a[0];
    const lengthSquared = dx * dx + dy * dy;
    const t = lengthSquared > 0
      ? Math.min(1, Math.max(0, (((point[1] - a[1]) * scale) * dx + (point[0] - a[0]) * dy) / lengthSquared))
      : 0;
    const foot: LatLng = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
    const offsetMeters = haversineMeters(toPoint(foot), toPoint(point));
    if (offsetMeters < best.offsetMeters) {
      best = { distance: track.cumulative[index]! + (track.cumulative[index + 1]! - track.cumulative[index]!) * t, offsetMeters };
    }
  }
  return best;
}
