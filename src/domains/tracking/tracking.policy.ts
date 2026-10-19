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
export type TrackingPosition = { state: "NOT_STARTED" | "ENDED" | "OFF_DUTY" | "ABSENT" | "STALE" | "FRESH"; latitude: number | null; longitude: number | null; accuracy: number | null; updatedAt: string | null; expiresAt: string | null };
export function trackingPosition(mission: { status: string; missionStartedAt: Date | string | null; completedAt?: Date | string | null }, driver: { status: string; settings: unknown; driverLocation: { latitude: number; longitude: number; accuracy?: number | null; updatedAt: Date } | null } | null, thresholdSeconds: number, now = new Date()): TrackingPosition {
  const empty = { latitude: null, longitude: null, accuracy: null, updatedAt: null, expiresAt: null };
  if (["DELIVERED", "FAILED", "CANCELLED", "INVOICED", "PAID"].includes(mission.status) || mission.completedAt) return { ...empty, state: "ENDED" };
  if (!missionIsTrackable(mission)) return { ...empty, state: "NOT_STARTED" };
  const service = trackingService(driver?.settings);
  if (!driver || driver.status !== "ACTIVE" || !service.active) return { ...empty, state: "OFF_DUTY" };
  const loc = driver.driverLocation;
  const begins = Math.max(+new Date(mission.missionStartedAt!), Date.parse(service.startedAt!));
  if (!loc || +loc.updatedAt < begins || +loc.updatedAt > +now || !Number.isFinite(loc.latitude) || !Number.isFinite(loc.longitude)) return { ...empty, state: "ABSENT" };
  const expiresAt = new Date(+loc.updatedAt + thresholdSeconds * 1000).toISOString();
  if (+now >= Date.parse(expiresAt)) return { ...empty, state: "STALE", updatedAt: loc.updatedAt.toISOString(), expiresAt };
  return { state: "FRESH", latitude: loc.latitude, longitude: loc.longitude, accuracy: loc.accuracy ?? null, updatedAt: loc.updatedAt.toISOString(), expiresAt };
}
/** These historical labels represent planned stops, not completed actions. */
export function isPlannedTrackingEvent(event: { label: string }) { return event.label === "Livraison" || /^Collecte(?:\s|$)/.test(event.label); }
export function trackingTimeline<T extends { id: string; label: string; description: string | null; occurredAt: Date }>(events: T[]) {
  return events.filter(event => !isPlannedTrackingEvent(event)).sort((a, b) => +a.occurredAt - +b.occurredAt || a.id.localeCompare(b.id)).map(({ id, label, description, occurredAt }) => ({ id, label, description, occurredAt: occurredAt.toISOString() }));
}
