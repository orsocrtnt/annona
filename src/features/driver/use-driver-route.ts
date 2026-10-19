"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { fetchOsrmNavigationRoute, type NavigationRoute } from "@/lib/maps/osrm-route";
import { ROUTE_REFRESH_MS } from "@/lib/maps/provider-config";

type Point = { latitude: number; longitude: number };

/** One calculation per interval; GPS updates alone never flood the public demo. */
export function useDriverRoute(position: Point | null, target: Point | null) {
  const positionRef = useRef(position);
  positionRef.current = position;
  const [route, setRoute] = useState<NavigationRoute | null>(null);
  const [loading, setLoading] = useState(false);
  const [unavailable, setUnavailable] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const lastRequestAt = useRef(0);
  const retry = useCallback(() => {
    if (Date.now() - lastRequestAt.current >= ROUTE_REFRESH_MS) setAttempt(a => a + 1);
  }, []);
  const hasPosition = Boolean(position);
  const latitude = target?.latitude;
  const longitude = target?.longitude;
  useEffect(() => {
    setRoute(null);
    setUnavailable(false);
    if (!hasPosition || latitude == null || longitude == null) { setLoading(false); return; }
    const controller = new AbortController();
    let running = false;
    const load = async () => {
      const from = positionRef.current;
      if (!from || running) return;
      running = true;
      lastRequestAt.current = Date.now();
      setLoading(true);
      const next = await fetchOsrmNavigationRoute([from, { latitude, longitude }], controller.signal);
      running = false;
      if (controller.signal.aborted) return;
      setRoute(next);
      setUnavailable(!next);
      setLoading(false);
    };
    const initial = setTimeout(() => void load(), 0);
    const timer = setInterval(() => void load(), ROUTE_REFRESH_MS);
    return () => { controller.abort(); clearTimeout(initial); clearInterval(timer); };
  }, [hasPosition, latitude, longitude, attempt]);
  return { route, loading, unavailable, retry };
}
