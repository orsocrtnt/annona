"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { DEFAULT_DRIVER_LOCATION_SETTINGS } from "@/lib/validations/driver-location-settings";
import { hasActiveDriverMission } from "@/lib/constants/driver-location";
import { useDriverMissions } from "@/features/driver/hooks";
import { useDriverLocationSettings } from "@/features/driver/location-settings-hooks";

type TrackingStatus = "idle" | "requesting" | "active" | "denied" | "unsupported";

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

export function DriverLocationTracker() {
  const pathname = usePathname();
  const isNavigatePage = pathname.startsWith("/driver/navigate");
  const [status, setStatus] = useState<TrackingStatus>("idle");
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const watchIdRef = useRef<number | null>(null);
  const lastSentAtRef = useRef(0);
  const { data: settings } = useDriverLocationSettings();
  const { data: missionData } = useDriverMissions();

  const locationSettings = settings ?? DEFAULT_DRIVER_LOCATION_SETTINGS;
  const hasActiveMission = useMemo(
    () => hasActiveDriverMission(missionData?.missions),
    [missionData?.missions]
  );

  const intervalMs = useMemo(() => {
    const seconds = hasActiveMission
      ? locationSettings.activeMissionIntervalSeconds
      : locationSettings.idleIntervalSeconds;
    return seconds * 1000;
  }, [hasActiveMission, locationSettings]);

  useEffect(() => {
    if (isNavigatePage) return;

    if (typeof window === "undefined" || !navigator.geolocation) {
      setStatus("unsupported");
      return;
    }

    const publishPosition = async (position: GeolocationPosition) => {
      try {
        await sendPosition(position);
        setStatus("active");
      } catch {
        setStatus("active");
      }
    };

    const clearWatch = () => {
      if (watchIdRef.current != null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
    };

    const clearIntervalTimer = () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };

    if (hasActiveMission) {
      clearIntervalTimer();
      setStatus("requesting");

      watchIdRef.current = navigator.geolocation.watchPosition(
        (position) => {
          const now = Date.now();
          if (now - lastSentAtRef.current < Math.min(intervalMs, 4_000)) return;
          lastSentAtRef.current = now;
          void publishPosition(position);
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
        clearWatch();
      };
    }

    clearWatch();
    const publish = () => {
      setStatus("requesting");
      navigator.geolocation.getCurrentPosition(
        (position) => {
          void publishPosition(position);
        },
        (error) => {
          if (error.code === error.PERMISSION_DENIED) {
            setStatus("denied");
          }
        },
        {
          enableHighAccuracy: false,
          maximumAge: Math.floor(intervalMs * 0.5),
          timeout: 12_000,
        }
      );
    };

    publish();
    intervalRef.current = setInterval(publish, intervalMs);

    return () => {
      clearIntervalTimer();
    };
  }, [hasActiveMission, intervalMs, isNavigatePage]);

  void status;
  return null;
}

export function useDriverTrackingStatus() {
  const [online, setOnline] = useState(false);

  useEffect(() => {
    if (!navigator.geolocation) return;

    const check = () => {
      navigator.permissions
        ?.query({ name: "geolocation" })
        .then((result) => setOnline(result.state === "granted"))
        .catch(() => setOnline(false));
    };

    check();
    const id = setInterval(check, 5_000);
    return () => clearInterval(id);
  }, []);

  return online;
}
