import { ESTIMATION_MAX_SECONDS } from "@/domains/tracking/tracking.policy";

/**
 * Couleurs de présence type Microsoft Teams : vert en direct, jaune pendant l'estimation
 * (signal périmé depuis moins de 3 min), rouge une fois le signal perdu.
 */
export const TEAMS_PRESENCE = {
  online: "#6BB700",
  recent: "#EAA300",
  lost: "#C4314B",
} as const;

export type DriverPresenceStatus = keyof typeof TEAMS_PRESENCE;

/** Signal perdu : aucun relevé depuis plus longtemps que la durée d'estimation. */
export function isSignalLost(updatedAt: string | null, now: number): boolean {
  return !updatedAt || now - Date.parse(updatedAt) > ESTIMATION_MAX_SECONDS * 1000;
}

export function getDriverPresenceStatus(isOnline: boolean, updatedAt: string | null, now: number): DriverPresenceStatus {
  if (isOnline) return "online";
  return isSignalLost(updatedAt, now) ? "lost" : "recent";
}

export function getDriverPresenceColor(isOnline: boolean, updatedAt: string | null, now: number): string {
  return TEAMS_PRESENCE[getDriverPresenceStatus(isOnline, updatedAt, now)];
}

/** « Il y a 3 min » à partir de l'heure du dernier signal. */
export function formatSignalAge(updatedAt: string, now: number): string {
  const seconds = Math.max(0, Math.floor((now - Date.parse(updatedAt)) / 1000));
  if (seconds < 60) return "Il y a moins d'1 min";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `Il y a ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  return hours < 24 ? `Il y a ${hours} h` : "Il y a plus d'un jour";
}

/**
 * Libellé sous le nom du livreur : « En direct », sinon l'âge du signal, complété par
 * « Position estimée » (estimation en cours) ou « Signal perdu » (au-delà de l'estimation).
 */
export function driverSignalLabel(
  signal: { isOnline: boolean; estimated?: boolean; updatedAt: string | null },
  now: number
): string {
  if (signal.isOnline) return "En direct";
  if (!signal.updatedAt) return "Signal inconnu";
  const age = formatSignalAge(signal.updatedAt, now);
  if (isSignalLost(signal.updatedAt, now)) return `${age} · Signal perdu`;
  return signal.estimated ? `${age} · Position estimée` : age;
}
