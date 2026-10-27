"use client";

import { useEffect, useRef, useState } from "react";
import type { TrackingMotion, TrackingPoint } from "@/domains/tracking/tracking.policy";
import { reuseRoad, type RoadTrack } from "@/lib/maps/driver-motion";
import { fetchOsrmRoute, type RouteWaypoint } from "@/lib/maps/osrm-route";
import { buildRouteTrack, projectOnRoute, type LatLng } from "@/lib/maps/route-progress";

/** Itinéraires déjà calculés, partagés par toutes les cartes de la page. */
const routeCache = new Map<string, LatLng[]>();
const ROUTE_CACHE_LIMIT = 100;
/** Le service public d'itinéraires limite à une requête par seconde : appels en file. */
const ROUTE_REQUEST_SPACING_MS = 1_150;
let routeQueue: Promise<unknown> = Promise.resolve();

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const pointKey = (point: TrackingPoint) => `${point.latitude.toFixed(5)},${point.longitude.toFixed(5)}`;

/**
 * Itinéraire routier passant par `waypoints`, en file avec tous les autres appels de la page
 * (une requête par seconde) et mis en cache. null si le service ne répond pas.
 */
export function requestQueuedRoute(waypoints: RouteWaypoint[]): Promise<LatLng[] | null> {
  const key = waypoints.map(pointKey).join(">");
  const cached = routeCache.get(key);
  if (cached) return Promise.resolve(cached);
  const run = routeQueue.then(async () => {
    // Une requête trop rapprochée d'un autre appel de la page renvoie null : un seul nouvel essai.
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const route = await fetchOsrmRoute(waypoints);
      if (route && route.length >= 2) {
        if (routeCache.size >= ROUTE_CACHE_LIMIT) routeCache.delete(routeCache.keys().next().value!);
        routeCache.set(key, route);
        return route;
      }
      if (attempt === 0) await wait(ROUTE_REQUEST_SPACING_MS);
    }
    return null;
  });
  routeQueue = run.then(() => wait(ROUTE_REQUEST_SPACING_MS), () => wait(ROUTE_REQUEST_SPACING_MS));
  return run;
}

/** Trajet animé : le relevé suivi et, s'il est chargé, son itinéraire routier. */
export type DrivenMotion = { motion: TrackingMotion | null; road: RoadTrack | null };

/**
 * Itinéraire routier du livreur vers sa prochaine étape. Un nouveau relevé resté sur la route
 * réutilise l'itinéraire chargé. Sinon, le livreur continue sur l'ancien itinéraire le temps
 * de calculer le nouveau, puis bascule une seule fois : jamais d'aller-retour par la ligne droite.
 */
export function useRoadTrack(motion: TrackingMotion | null): DrivenMotion {
  const [driven, setDriven] = useState<DrivenMotion>({ motion, road: null });
  const drivenRef = useRef<DrivenMotion>(driven);
  const motionKey = motion ? `${motion.since}|${pointKey(motion.from)}|${pointKey(motion.target)}` : "";

  useEffect(() => {
    const apply = (next: DrivenMotion) => {
      drivenRef.current = next;
      setDriven(next);
    };
    if (!motion) {
      apply({ motion: null, road: null });
      return;
    }
    const reused = reuseRoad(drivenRef.current.road, motion);
    if (reused) {
      apply({ motion, road: reused });
      return;
    }
    // Aucun itinéraire en cours : ligne droite tout de suite, la route remplacera à son arrivée.
    if (!drivenRef.current.road) apply({ motion, road: null });
    let cancelled = false;
    void requestQueuedRoute([motion.from, motion.target]).then((points) => {
      if (cancelled) return;
      if (!points) {
        apply({ motion, road: null });
        return;
      }
      const track = buildRouteTrack(points);
      apply({ motion, road: { track, startDistance: projectOnRoute(track, [motion.from.latitude, motion.from.longitude]).distance } });
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- clé stable : relevé, cible et heure
  }, [motionKey]);

  return driven;
}
