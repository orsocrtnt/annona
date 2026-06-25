"use client";

import { useEffect, useRef, useState } from "react";

export type LivePositionStatus = "idle" | "requesting" | "active" | "denied" | "unsupported";

export type LivePosition = {
  latitude: number;
  longitude: number;
  accuracy?: number;
  heading?: number | null;
  speed?: number | null;
};

async function sendPosition(position: GeolocationPosition) {
  await fetch("/api/driver/location", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
      accuracy: position.coords.accuracy,
    }),
  });
}

export function useDriverLivePosition(enabled: boolean) {
  const [position, setPosition] = useState<LivePosition | null>(null);
  const [status, setStatus] = useState<LivePositionStatus>("idle");
  const lastSentAt = useRef(0);

  useEffect(() => {
    if (!enabled || typeof window === "undefined" || !navigator.geolocation) {
      setStatus("unsupported");
      return;
    }

    const publish = async (geo: GeolocationPosition) => {
      setPosition({
        latitude: geo.coords.latitude,
        longitude: geo.coords.longitude,
        accuracy: geo.coords.accuracy,
        heading:
          geo.coords.heading != null && geo.coords.heading >= 0
            ? geo.coords.heading
            : null,
        speed: geo.coords.speed != null && geo.coords.speed >= 0 ? geo.coords.speed : null,
      });
      setStatus("active");

      const now = Date.now();
      if (now - lastSentAt.current < 4_000) return;
      lastSentAt.current = now;

      try {
        await sendPosition(geo);
      } catch {
        // ignore network errors — position still shown locally
      }
    };

    setStatus("requesting");
    const watchId = navigator.geolocation.watchPosition(
      (geo) => {
        void publish(geo);
      },
      (error) => {
        if (error.code === error.PERMISSION_DENIED) {
          setStatus("denied");
        }
      },
      {
        enableHighAccuracy: true,
        maximumAge: 2_000,
        timeout: 15_000,
      }
    );

    return () => {
      navigator.geolocation.clearWatch(watchId);
    };
  }, [enabled]);

  return { position, status };
}
