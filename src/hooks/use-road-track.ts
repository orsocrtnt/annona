"use client";

import { useEffect, useRef, useState } from "react";
import type { TrackingMotion, TrackingPoint } from "@/domains/tracking/tracking.policy";
import { reuseRoad, type RoadTrack } from "@/lib/maps/driver-motion";
import { fetchOsrmRoute } from "@/lib/maps/osrm-route";
import { buildRouteTrack, projectOnRoute, type LatLng } from "@/lib/maps/route-progress";

/** Itinéraires déjà calculés, partagés par toutes les cartes de la page. */
const routeCache = new Map<string, LatLng[]>();
const ROUTE_CACHE_LIMIT = 100;
/** Le service public d'itinéraires limite à une requête par seconde : appels en file. */
const ROUTE_REQUEST_SPACING_MS = 1_150;
let routeQueue: Promise<unknown> = Promise.resolve();

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const pointKey = (point: TrackingPoint) => `${point.latitude.toFixed(5)},${point.longitude.toFixed(5)}`;

function requestRoadRoute(from: TrackingPoint, target: TrackingPoint): Promise<LatLng[] | null> {
  const key = `${pointKey(from)}>${pointKey(target)}`;
  const cached = routeCache.get(key);
  if (cached) return Promise.resolve(cached);
  const run = routeQueue.then(async () => {
    // Une requête trop rapprochée d'un autre appel de la page renvoie null : un seul nouvel essai.
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const route = await fetchOsrmRoute([from, target]);
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

/**
 * Itinéraire routier du livreur vers sa prochaine étape. Un nouveau relevé resté sur la route
 * réutilise l'itinéraire chargé ; sinon il est recalculé (ligne droite en attendant : null).
 */
export function useRoadTrack(motion: TrackingMotion | null): RoadTrack | null {
  const [road, setRoad] = useState<RoadTrack | null>(null);
  const roadRef = useRef<RoadTrack | null>(null);
  const motionKey = motion ? `${motion.since}|${pointKey(motion.from)}|${pointKey(motion.target)}` : "";

  useEffect(() => {
    const apply = (next: RoadTrack | null) => {
      roadRef.current = next;
      setRoad(next);
    };
    if (!motion) {
      apply(null);
      return;
    }
    const reused = reuseRoad(roadRef.current, motion);
    if (reused) {
      apply(reused);
      return;
    }
    apply(null);
    let cancelled = false;
    void requestRoadRoute(motion.from, motion.target).then((points) => {
      if (cancelled || !points) return;
      const track = buildRouteTrack(points);
      apply({ track, startDistance: projectOnRoute(track, [motion.from.latitude, motion.from.longitude]).distance });
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- clé stable : relevé, cible et heure
  }, [motionKey]);

  return road;
}
