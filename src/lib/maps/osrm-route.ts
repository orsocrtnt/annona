import { buildManeuverInstruction } from "@/lib/maps/navigation-utils";

export type RouteWaypoint = {
  latitude: number;
  longitude: number;
  label?: string;
};

export type NavigationRouteStep = {
  instruction: string;
  distanceMeters: number;
  latitude: number;
  longitude: number;
  maneuverType: string;
  modifier?: string | null;
  streetName?: string | null;
};

export type NavigationRoute = {
  polyline: [number, number][];
  distanceMeters: number;
  durationSeconds: number;
  steps: NavigationRouteStep[];
};

type OsrmStep = {
  distance: number;
  name?: string;
  maneuver: {
    type: string;
    modifier?: string | null;
    location: [number, number];
  };
};

/** Itinéraire OSRM (fallback : lignes droites entre les points). */
export async function fetchOsrmRoute(
  waypoints: RouteWaypoint[]
): Promise<[number, number][]> {
  const route = await fetchOsrmNavigationRoute(waypoints);
  return route.polyline;
}

/** Itinéraire OSRM avec distance, durée et étapes de navigation. */
export async function fetchOsrmNavigationRoute(
  waypoints: RouteWaypoint[]
): Promise<NavigationRoute> {
  const fallbackPolyline = waypoints.map((w) => [w.latitude, w.longitude] as [number, number]);

  if (waypoints.length < 2) {
    return {
      polyline: fallbackPolyline,
      distanceMeters: 0,
      durationSeconds: 0,
      steps: [],
    };
  }

  try {
    const coords = waypoints.map((w) => `${w.longitude},${w.latitude}`).join(";");
    const url = `https://router.project-osrm.org/route/v1/driving/${coords}?overview=full&geometries=geojson&steps=true`;
    const res = await fetch(url);
    const json = (await res.json()) as {
      code?: string;
      routes?: {
        distance: number;
        duration: number;
        geometry: { coordinates: [number, number][] };
        legs?: { steps: OsrmStep[] }[];
      }[];
    };

    if (json.code !== "Ok" || !json.routes?.[0]?.geometry?.coordinates?.length) {
      return {
        polyline: fallbackPolyline,
        distanceMeters: 0,
        durationSeconds: 0,
        steps: [],
      };
    }

    const route = json.routes[0];
    const polyline = route.geometry.coordinates.map(([lng, lat]) => [lat, lng] as [number, number]);
    const steps: NavigationRouteStep[] = [];

    for (const leg of route.legs ?? []) {
      for (const step of leg.steps ?? []) {
        const [lng, lat] = step.maneuver.location;
        steps.push({
          instruction: buildManeuverInstruction(
            step.maneuver.type,
            step.maneuver.modifier,
            step.name
          ),
          distanceMeters: step.distance,
          latitude: lat,
          longitude: lng,
          maneuverType: step.maneuver.type,
          modifier: step.maneuver.modifier,
          streetName: step.name ?? null,
        });
      }
    }

    return {
      polyline,
      distanceMeters: route.distance,
      durationSeconds: route.duration,
      steps,
    };
  } catch {
    return {
      polyline: fallbackPolyline,
      distanceMeters: 0,
      durationSeconds: 0,
      steps: [],
    };
  }
}
