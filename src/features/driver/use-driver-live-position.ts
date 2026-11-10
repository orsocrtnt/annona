"use client";

import { useEffect, useRef, useState } from "react";
import {
  geolocationErrorStatus,
  locationIsStale,
  publishDriverLocation,
  type DriverLocationClientStatus,
} from "@/lib/tracking/driver-location-client";

import { rememberDriverPosition, clearRememberedDriverPosition } from "@/lib/maps/driver-proximity";
import { watchDriverPosition, type DriverPosition } from "@/lib/native/geolocation";
import { watchConnectivity } from "@/lib/native/network";

export type LivePositionStatus = DriverLocationClientStatus;

/** Lot 1, demande 5 : renvoi de la dernière position après 20 s sans envoi (objectif : 30 s au plus). */
export const HEARTBEAT_MS = 20_000;
const HEARTBEAT_CHECK_MS = 5_000;

export type LivePosition = {
  latitude: number;
  longitude: number;
  accuracy?: number;
  heading?: number | null;
  speed?: number | null;
};

export function useDriverLivePosition(
  enabled: boolean,
  options: { minSendIntervalMs?: number; staleAfterMs?: number } = {}
) {
  const [position, setPosition] = useState<LivePosition | null>(null);
  const [status, setStatus] = useState<LivePositionStatus>("stopped");
  const [lastPositionAt, setLastPositionAt] = useState<string | null>(null);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [retryToken, setRetryToken] = useState(0);
  const lastSentAt = useRef(0);
  const latestPosition = useRef<DriverPosition | null>(null);
  const minSendIntervalMs = options.minSendIntervalMs ?? 4_000;
  const staleAfterMs = options.staleAfterMs ?? 45_000;

  useEffect(() => {
    if (!enabled) {
      setStatus("stopped");
      setPosition(null);
      setLastPositionAt(null);
      setLastSyncedAt(null);
      setSyncError(null);
      clearRememberedDriverPosition();
      latestPosition.current = null;
      lastSentAt.current = 0;
      return;
    }
    if (typeof window === "undefined") {
      setStatus("unsupported");
      return;
    }

    let cancelled = false;
    let publishInFlight = false;

    const publish = async (geo: DriverPosition, force = false) => {
      if (cancelled) return;
      rememberDriverPosition(geo);
      latestPosition.current = geo;
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
      setLastPositionAt(new Date(geo.timestamp || Date.now()).toISOString());

      const now = Date.now();
      if (!force && now - lastSentAt.current < minSendIntervalMs) return;
      if (publishInFlight) return;
      lastSentAt.current = now;
      publishInFlight = true;

      try {
        const confirmation = await publishDriverLocation({
          latitude: geo.coords.latitude,
          longitude: geo.coords.longitude,
          accuracy: geo.coords.accuracy,
        });
        if (cancelled) return;
        setLastSyncedAt(confirmation.updatedAt);
        setSyncError(null);
        setStatus("synced");
      } catch (error) {
        if (cancelled) return;
        setSyncError(error instanceof Error ? error.message : "Synchronisation GPS impossible.");
        setStatus(navigator.onLine ? "sync-error" : "offline");
      } finally {
        publishInFlight = false;
      }
    };

    setStatus("requesting");
    // MOBILE-1 : module natif dans l'application, `navigator.geolocation` dans un navigateur.
    const stopWatch = watchDriverPosition(
      {
        onPosition: (geo) => {
          void publish(geo);
        },
        onError: (code, message) => {
          if (cancelled) return;
          setSyncError(message || null);
          setStatus(code === 2 && !("geolocation" in navigator) ? "unsupported" : geolocationErrorStatus(code));
        },
      },
      {
        enableHighAccuracy: true,
        maximumAge: 2_000,
        timeout: 15_000,
      }
    );

    const stopConnectivity = watchConnectivity({
      onOffline: () => {
        setSyncError("Connexion réseau perdue.");
        setStatus("offline");
      },
      onOnline: () => {
        const current = latestPosition.current;
        if (!current) {
          setStatus("requesting");
          return;
        }
        lastSentAt.current = 0;
        void publish(current, true);
      },
    });

    // Lot 1, demande 5 : position renvoyée au moins toutes les 30 s pendant la tournée, même à l'arrêt
    // (le GPS ne signale rien quand le téléphone ne bouge pas) : l'administrateur voit un livreur à jour.
    const heartbeat = window.setInterval(() => {
      const current = latestPosition.current;
      if (current && Date.now() - lastSentAt.current >= HEARTBEAT_MS) void publish(current, true);
    }, HEARTBEAT_CHECK_MS);

    return () => {
      cancelled = true;
      window.clearInterval(heartbeat);
      clearRememberedDriverPosition();
      stopWatch();
      stopConnectivity();
    };
  }, [enabled, minSendIntervalMs, retryToken]);

  useEffect(() => {
    if (!enabled || !lastSyncedAt) return;
    const remaining = staleAfterMs - (Date.now() - Date.parse(lastSyncedAt));
    if (remaining <= 0) {
      setStatus((current) => current === "synced" ? "stale" : current);
      return;
    }
    const timeout = window.setTimeout(() => {
      if (locationIsStale(lastSyncedAt, staleAfterMs)) {
        setStatus((current) => current === "synced" ? "stale" : current);
      }
    }, remaining + 25);
    return () => window.clearTimeout(timeout);
  }, [enabled, lastSyncedAt, staleAfterMs]);

  return {
    position,
    status,
    lastPositionAt,
    lastSyncedAt,
    syncError,
    retry: () => setRetryToken((value) => value + 1),
  };
}
