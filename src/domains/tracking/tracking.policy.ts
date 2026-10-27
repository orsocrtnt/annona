export const TRACKING_POLL_MS = 10_000;
const activeStatuses = new Set(["ASSIGNED", "PURCHASING", "IN_DELIVERY"]);
export function trackingService(settings: unknown) {
  const raw = (settings as { trackingService?: { active?: unknown; startedAt?: unknown; endedAt?: unknown } } | null)?.trackingService;
  const startedAt = typeof raw?.startedAt === "string" && Number.isFinite(Date.parse(raw.startedAt)) ? raw.startedAt : null;
  return { active: raw?.active === true && Boolean(startedAt), startedAt, endedAt: typeof raw?.endedAt === "string" ? raw.endedAt : null };
}
export function missionIsTrackable(mission: { status: string; missionStartedAt: Date | string | null; completedAt?: Date | string | null }) {
  return activeStatuses.has(mission.status) && Boolean(mission.missionStartedAt) && !mission.completedAt;
}
/** Hypothèses de l'estimation quand le signal se perd : ligne droite à vitesse urbaine, puis arrêt. */
export const ESTIMATION_SPEED_KMH = 25;
/** Au-delà, le signal est perdu : le livreur s'arrête au point estimé atteint. */
export const ESTIMATION_MAX_SECONDS = 3 * 60;
export type TrackingPoint = { latitude: number; longitude: number };
const isPoint = (lat: number | null | undefined, lng: number | null | undefined): boolean => Number.isFinite(lat) && Number.isFinite(lng) && lat != null && lng != null;
function distanceKm(a: TrackingPoint, b: TrackingPoint) {
  const rad = Math.PI / 180, dLat = (b.latitude - a.latitude) * rad, dLng = (b.longitude - a.longitude) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.latitude * rad) * Math.cos(b.latitude * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.min(1, Math.sqrt(h)));
}
/** Avance en ligne droite depuis `from` vers `target` à `speedKmh`, sans jamais dépasser la cible. */
export function estimatePosition(from: TrackingPoint, target: TrackingPoint, elapsedSeconds: number, speedKmh = ESTIMATION_SPEED_KMH): TrackingPoint {
  const distance = distanceKm(from, target);
  if (!(distance > 0) || !(elapsedSeconds > 0)) return { latitude: from.latitude, longitude: from.longitude };
  const ratio = Math.min(1, (speedKmh * elapsedSeconds) / 3600 / distance);
  return { latitude: from.latitude + (target.latitude - from.latitude) * ratio, longitude: from.longitude + (target.longitude - from.longitude) * ratio };
}
export type TrackingTargetMission = { status: string; deliveryCategory?: string | null; latitude?: number | null; longitude?: number | null; pickupLatitude?: number | null; pickupLongitude?: number | null; order?: { stops?: { latitude?: number | null; longitude?: number | null }[] } | null };
/** Prochaine étape : destination en livraison (ou course collectée), collecte pour une course en route ; sinon aucune. */
export function trackingTarget(mission: TrackingTargetMission): TrackingPoint | null {
  const toDestination = mission.status === "IN_DELIVERY" || (mission.deliveryCategory === "COURIER" && mission.status === "PURCHASING");
  if (toDestination) return isPoint(mission.latitude, mission.longitude) ? { latitude: mission.latitude!, longitude: mission.longitude! } : null;
  if (mission.deliveryCategory !== "COURIER" || mission.status !== "ASSIGNED") return null;
  const stop = mission.order?.stops?.find(s => isPoint(s.latitude, s.longitude));
  if (stop) return { latitude: stop.latitude!, longitude: stop.longitude! };
  return isPoint(mission.pickupLatitude, mission.pickupLongitude) ? { latitude: mission.pickupLatitude!, longitude: mission.pickupLongitude! } : null;
}
/** Trajet supposé depuis le dernier relevé : l'interface fait avancer le livreur entre deux signaux. */
export type TrackingMotion = { from: TrackingPoint; target: TrackingPoint; since: string };
/** Position supposée à l'instant `nowMs` : avance vers la cible, puis s'arrête une fois le signal perdu. */
export function motionPositionAt(motion: TrackingMotion, nowMs: number): TrackingPoint {
  const elapsedSeconds = Math.min(Math.max(0, (nowMs - Date.parse(motion.since)) / 1000), ESTIMATION_MAX_SECONDS);
  return estimatePosition(motion.from, motion.target, elapsedSeconds);
}
export type TrackingPosition = { state: "NOT_STARTED" | "ENDED" | "OFF_DUTY" | "ABSENT" | "STALE" | "FRESH"; latitude: number | null; longitude: number | null; accuracy: number | null; updatedAt: string | null; expiresAt: string | null; estimated: boolean; motion: TrackingMotion | null };
export function trackingPosition(mission: { status: string; missionStartedAt: Date | string | null; completedAt?: Date | string | null }, driver: { status: string; settings: unknown; driverLocation: { latitude: number; longitude: number; accuracy?: number | null; updatedAt: Date } | null } | null, thresholdSeconds: number, now = new Date(), target: TrackingPoint | null = null): TrackingPosition {
  const empty = { latitude: null, longitude: null, accuracy: null, updatedAt: null, expiresAt: null, estimated: false, motion: null };
  if (["DELIVERED", "FAILED", "CANCELLED", "INVOICED", "PAID"].includes(mission.status) || mission.completedAt) return { ...empty, state: "ENDED" };
  if (!missionIsTrackable(mission)) return { ...empty, state: "NOT_STARTED" };
  const service = trackingService(driver?.settings);
  if (!driver || driver.status !== "ACTIVE" || !service.active) return { ...empty, state: "OFF_DUTY" };
  const loc = driver.driverLocation;
  const begins = Math.max(+new Date(mission.missionStartedAt!), Date.parse(service.startedAt!));
  if (!loc || +loc.updatedAt < begins || +loc.updatedAt > +now || !Number.isFinite(loc.latitude) || !Number.isFinite(loc.longitude)) return { ...empty, state: "ABSENT" };
  const expiresAt = new Date(+loc.updatedAt + thresholdSeconds * 1000).toISOString();
  const updatedAt = loc.updatedAt.toISOString();
  const motion = target ? { from: { latitude: loc.latitude, longitude: loc.longitude }, target, since: updatedAt } : null;
  if (+now >= Date.parse(expiresAt)) {
    // Signal périmé : position estimée vers la prochaine étape pendant 3 min, puis arrêt au point atteint (signal perdu).
    if (motion) {
      const estimated = (+now - +loc.updatedAt) / 1000 <= ESTIMATION_MAX_SECONDS;
      return { state: "STALE", ...motionPositionAt(motion, +now), accuracy: null, updatedAt, expiresAt, estimated, motion };
    }
    return { state: "STALE", latitude: loc.latitude, longitude: loc.longitude, accuracy: loc.accuracy ?? null, updatedAt, expiresAt, estimated: false, motion: null };
  }
  return { state: "FRESH", latitude: loc.latitude, longitude: loc.longitude, accuracy: loc.accuracy ?? null, updatedAt, expiresAt, estimated: false, motion };
}
/** These historical labels represent planned stops, not completed actions. */
export function isPlannedTrackingEvent(event: { label: string }) { return event.label === "Livraison" || /^Collecte(?:\s|$)/.test(event.label); }
export function trackingTimeline<T extends { id: string; label: string; description: string | null; occurredAt: Date }>(events: T[]) {
  return events.filter(event => !isPlannedTrackingEvent(event)).sort((a, b) => +a.occurredAt - +b.occurredAt || a.id.localeCompare(b.id)).map(({ id, label, description, occurredAt }) => ({ id, label, description, occurredAt: occurredAt.toISOString() }));
}
