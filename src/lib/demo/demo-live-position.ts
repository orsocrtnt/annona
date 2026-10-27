import { DEMO_COMPANY_SLUG } from "@/lib/demo/constants";

type Point = { latitude: number; longitude: number };

/** Cycle d'aller-retour d'un livreur simulé : assez lent pour paraître réel, assez rapide pour se voir. */
export const DEMO_POSITION_CYCLE_MS = 12 * 60 * 1000;
/** Une position plus récente que ce délai n'est pas réécrite (lectures rapprochées). */
export const DEMO_POSITION_MIN_INTERVAL_MS = 10 * 1000;

/** Seules les entreprises de démo (vitrine, pool, sessions) peuvent recevoir des positions simulées. */
export function isDemoCompanyForSimulation(company: { isDemo: boolean; slug: string } | null): boolean {
  if (!company?.isDemo) return false;
  return company.slug === DEMO_COMPANY_SLUG || company.slug.startsWith(`${DEMO_COMPANY_SLUG}-`);
}

/** Point de départ : la collecte si elle est connue, sinon un point décalé d'environ 2,5 km. */
export function demoStartPoint(destination: Point, pickup: Point | null): Point {
  return pickup ?? { latitude: destination.latitude + 0.018, longitude: destination.longitude - 0.022 };
}

/**
 * Position du livreur simulé : il avance de la collecte vers l'adresse puis repart, sans jamais
 * toucher l'arrivée (la mission ne paraît pas terminée). Déterministe pour un instant donné.
 */
export function demoDriverPosition(start: Point, destination: Point, missionStartedAt: Date, now: Date): Point {
  const elapsed = Math.max(0, now.getTime() - missionStartedAt.getTime());
  const phase = (elapsed % DEMO_POSITION_CYCLE_MS) / DEMO_POSITION_CYCLE_MS;
  const pingPong = phase < 0.5 ? phase * 2 : (1 - phase) * 2;
  const progress = 0.08 + pingPong * 0.82;
  return {
    latitude: start.latitude + (destination.latitude - start.latitude) * progress,
    longitude: start.longitude + (destination.longitude - start.longitude) * progress,
  };
}
