import { DEMO_COMPANY_SLUG } from "@/lib/demo/constants";

type Point = { latitude: number; longitude: number };

/** Cycle d'aller-retour d'un livreur simulé : assez lent pour paraître réel, assez rapide pour se voir. */
export const DEMO_POSITION_CYCLE_MS = 12 * 60 * 1000;
/** Une position plus récente que ce délai n'est pas réécrite (lectures rapprochées). */
export const DEMO_POSITION_MIN_INTERVAL_MS = 10 * 1000;

/**
 * Retard fictif du dernier signal par livreur de démo, dans l'ordre du roster : en direct (0),
 * signal périmé depuis 100 s (position estimée) ou perdu (au-delà de 3 min : un seul relevé,
 * figé une minute après le départ, qui ne bouge plus).
 */
export const DEMO_SIGNAL_LAG_SECONDS = [0, 0, 100, 0, 900] as const;
/** Heure du relevé figé d'un livreur au signal perdu, après le départ de sa mission. */
export const DEMO_LOST_SIGNAL_AFTER_START_MS = 60 * 1000;
const DEMO_SIGNAL_LAG_MAX_SECONDS = 3600;

/** Retard lu dans les réglages du livreur ; 0 si absent ou invalide, plafonné à une heure. */
export function demoSignalLagSeconds(settings: unknown): number {
  const raw = (settings as { demoSignalLagSeconds?: unknown } | null)?.demoSignalLagSeconds;
  if (typeof raw !== "number" || !Number.isFinite(raw)) return 0;
  return Math.min(DEMO_SIGNAL_LAG_MAX_SECONDS, Math.max(0, Math.round(raw)));
}

const PARIS_CENTER: Point = { latitude: 48.8566, longitude: 2.3522 };

/** Seules les entreprises de démo (vitrine, pool, sessions) peuvent recevoir des positions simulées. */
export function isDemoCompanyForSimulation(company: { isDemo: boolean; slug: string } | null): boolean {
  if (!company?.isDemo) return false;
  return company.slug === DEMO_COMPANY_SLUG || company.slug.startsWith(`${DEMO_COMPANY_SLUG}-`);
}

/**
 * Point de départ du trajet simulé, toujours dans Paris : à mi-chemin entre la cible et le
 * centre, ou à environ 2 km au nord-est quand la cible est déjà au centre.
 */
export function demoTripStart(target: Point): Point {
  const dLat = PARIS_CENTER.latitude - target.latitude;
  const dLng = PARIS_CENTER.longitude - target.longitude;
  if (Math.hypot(dLat, dLng) < 0.015) {
    return { latitude: target.latitude + 0.014, longitude: target.longitude + 0.012 };
  }
  return { latitude: target.latitude + dLat * 0.6, longitude: target.longitude + dLng * 0.6 };
}

/**
 * Avancement sur le trajet : de 8 % à 90 % puis retour, sans jamais atteindre la cible
 * (la mission ne paraît pas terminée). Déterministe pour un instant donné.
 */
export function demoTripProgress(missionStartedAt: Date, now: Date): number {
  const elapsed = Math.max(0, now.getTime() - missionStartedAt.getTime());
  const phase = (elapsed % DEMO_POSITION_CYCLE_MS) / DEMO_POSITION_CYCLE_MS;
  const pingPong = phase < 0.5 ? phase * 2 : (1 - phase) * 2;
  return 0.08 + pingPong * 0.82;
}

/**
 * Distance parcourue sur un trajet simulé de `lengthMeters`, à la vitesse supposée entre deux
 * signaux : le livreur avance toujours vers la cible (comme l'estimation des cartes), de 8 % à
 * 90 % du trajet, puis repart du début. Déterministe pour un instant donné.
 */
export function demoTripDistance(missionStartedAt: Date, at: Date, lengthMeters: number, speedKmh: number): number {
  if (!(lengthMeters > 0)) return 0;
  const travelled = (Math.max(0, at.getTime() - missionStartedAt.getTime()) / 1000) * (speedKmh / 3.6);
  return lengthMeters * 0.08 + (travelled % (lengthMeters * 0.82));
}

/** Point situé à `progress` (0 à 1) de la longueur d'un tracé [lat, lng] : reste sur la route. */
export function pointAlongPolyline(polyline: [number, number][], progress: number): Point {
  if (polyline.length === 0) throw new Error("EMPTY_POLYLINE");
  const first = polyline[0]!;
  if (polyline.length === 1) return { latitude: first[0], longitude: first[1] };
  // Distances approchées en degrés, corrigées de la latitude : suffisant à l'échelle d'une ville.
  const scale = Math.cos((first[0] * Math.PI) / 180);
  const segments = polyline.slice(1).map((point, index) => {
    const previous = polyline[index]!;
    return Math.hypot(point[0] - previous[0], (point[1] - previous[1]) * scale);
  });
  const total = segments.reduce((sum, length) => sum + length, 0);
  let remaining = Math.min(Math.max(progress, 0), 1) * total;
  for (let index = 0; index < segments.length; index += 1) {
    const length = segments[index]!;
    const from = polyline[index]!;
    const to = polyline[index + 1]!;
    if (remaining <= length || index === segments.length - 1) {
      const ratio = length === 0 ? 0 : Math.min(remaining / length, 1);
      return {
        latitude: from[0] + (to[0] - from[0]) * ratio,
        longitude: from[1] + (to[1] - from[1]) * ratio,
      };
    }
    remaining -= length;
  }
  const last = polyline[polyline.length - 1]!;
  return { latitude: last[0], longitude: last[1] };
}
