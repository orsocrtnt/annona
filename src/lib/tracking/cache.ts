type Snapshot = { orderId: string; status: string; updatedAt: string; deliveries: Array<{ id: string; status: string; updatedAt: string; driverName: string | null; missionAcceptedAt: string | null; missionStartedAt: string | null; completedAt: string | null; timeline: Array<{ id: string; label: string; description: string | null; occurredAt: string }> }> };
function object(value: unknown): value is Record<string, unknown> { return Boolean(value) && typeof value === "object" && !Array.isArray(value); }
function fields(current: Record<string, unknown>, snapshot: Record<string, unknown>) {
  if (typeof current.updatedAt === "string" && typeof snapshot.updatedAt === "string" && Date.parse(current.updatedAt) > Date.parse(snapshot.updatedAt)) return current;
  const next = { ...current }; let changed = false;
  for (const key of ["status", "updatedAt", "driverName", "missionAcceptedAt", "missionStartedAt", "completedAt"]) {
    if (key in current && key in snapshot && current[key] !== snapshot[key]) { next[key] = snapshot[key]; changed = true; }
  }
  return changed ? next : current;
}
function delivery(current: unknown, data: Snapshot) {
  if (!object(current)) return current;
  const snapshot = data.deliveries.find(d => d.id === current.id); if (!snapshot) return current;
  const next = fields(current, snapshot);
  // A newer detail response (e.g. an action in flight) must not be overwritten.
  if (typeof current.updatedAt === "string" && Date.parse(current.updatedAt) > Date.parse(snapshot.updatedAt)) return current;
  if (!Array.isArray(current.trackingEvents)) return next;
  const oldEvents = current.trackingEvents;
  const events = snapshot.timeline.map(event => ({ ...oldEvents.find(old => object(old) && old.id === event.id), ...event }));
  return JSON.stringify(oldEvents) === JSON.stringify(events) ? next : { ...next, trackingEvents: events };
}
/** Only patch existing detail caches; never manufacture a partial query result. */
export function syncTrackingDetail(current: unknown, data: Snapshot, kind: "order" | "delivery") {
  if (!object(current)) return current;
  if (kind === "delivery") return delivery(current, data);
  if (current.id !== data.orderId) return current;
  const next = fields(current, { status: data.status, updatedAt: data.updatedAt });
  if (!Array.isArray(current.deliveries)) return next;
  const children = current.deliveries.map(d => delivery(d, data));
  return children.every((d, i) => d === (current.deliveries as unknown[])[i]) ? next : { ...next, deliveries: children };
}
