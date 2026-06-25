/** Couleurs statut type Microsoft Teams */
export const TEAMS_PRESENCE = {
  online: "#6BB700",
  recent: "#EAA300",
  stale: "#C4314B",
} as const;

export type DriverPresenceStatus = keyof typeof TEAMS_PRESENCE;

const RECENT_THRESHOLD_MS = 60 * 60 * 1000; // 1 h

export function getDriverPresenceStatus(
  isOnline: boolean,
  updatedAt: string | null
): DriverPresenceStatus {
  if (isOnline) return "online";
  if (!updatedAt) return "stale";
  const age = Date.now() - new Date(updatedAt).getTime();
  if (age <= RECENT_THRESHOLD_MS) return "recent";
  return "stale";
}

export function getDriverPresenceColor(
  isOnline: boolean,
  updatedAt: string | null
): string {
  return TEAMS_PRESENCE[getDriverPresenceStatus(isOnline, updatedAt)];
}
