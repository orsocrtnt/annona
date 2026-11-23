"use client";

import { useMemo } from "react";
import type { LiveRound } from "@/domains/round/round.types";
import type { TrackedDriver } from "@/domains/round/driver-tracking.service";
import { useLiveDashboard } from "@/features/rounds/hooks";
import { useDriverTracking } from "@/features/tracking/hooks";
import { roundColor, type DeliveryMapRound } from "@/features/delivery-map/delivery-map";
import { useCanOpenPage } from "@/hooks/use-can-open-page";

export interface DeliveryMapRoundDetails extends DeliveryMapRound {
  live: LiveRound;
  /** Suivi détaillé (prochains arrêts, livrés, problèmes), seulement pour une tournée démarrée. */
  tracked: TrackedDriver | null;
}

/**
 * CARTE-1 — données de la carte du gérant : les tournées du jour (arrêts, avancement) et, pour celles qui roulent,
 * la position du livreur et son trajet. Même source pour la page « Carte » et le tableau de bord : même couleur
 * pour une tournée partout. Le suivi n'est lu que si le compte peut ouvrir la page « Carte » (mini admin).
 */
/** Mini admin sans « Tableau de bord » ni « Tournées » : la tournée est reconstruite à partir du seul suivi. */
export function liveRoundFromTracking(driver: TrackedDriver): LiveRound {
  const stops = [...driver.delivered, ...driver.incidents, ...driver.nextStops].sort((a, b) => a.sequence - b.sequence);
  const last = driver.delivered.at(-1);
  return {
    id: driver.roundId,
    name: driver.roundName,
    slotLabel: driver.slotLabel,
    status: "IN_PROGRESS",
    driverName: driver.driverName,
    progress: {
      total: stops.length,
      delivered: driver.delivered.length,
      incidents: driver.incidents.length,
      remaining: driver.remainingCount,
    },
    startedAt: driver.startedAt,
    completedAt: null,
    lastDeliveredAt: last?.deliveredAt ?? null,
    nextStopName: driver.nextStops[0]?.merchantName ?? null,
    driverPosition: driver.position ? { latitude: driver.position.latitude, longitude: driver.position.longitude, updatedAt: driver.position.updatedAt } : null,
    stops: stops.map(({ id, sequence, status, merchantName, latitude, longitude }) => ({ id, sequence, status, merchantName, latitude, longitude })),
  };
}

export function useDeliveryMapData() {
  // Lot 1, demande 4 : chaque source n'est lue que si le compte y a droit (mini admin).
  const canDashboard = useCanOpenPage("/dashboard");
  const canRounds = useCanOpenPage("/dashboard/rounds");
  const canLive = canDashboard || canRounds;
  const canTrack = useCanOpenPage("/dashboard/tracking");
  const live = useLiveDashboard({ enabled: canLive });
  const tracking = useDriverTracking({ enabled: canTrack });

  const rounds = useMemo<DeliveryMapRoundDetails[]>(() => {
    const drivers = new Map((tracking.data?.drivers ?? []).map((driver) => [driver.roundId, driver]));
    const source = canLive ? live.data?.rounds ?? [] : (tracking.data?.drivers ?? []).map(liveRoundFromTracking);
    return source.map((round, index) => {
      const tracked = drivers.get(round.id) ?? null;
      const position = tracked?.position ?? round.driverPosition;
      return {
        id: round.id,
        name: round.name,
        color: roundColor(index),
        driverName: round.driverName,
        progress: { delivered: round.progress.delivered, total: round.progress.total },
        driverPosition: position ? { latitude: position.latitude, longitude: position.longitude, stale: tracked?.position?.stale ?? false } : null,
        route: tracked ? { polyline: tracked.route.polyline, approximate: tracked.route.approximate } : null,
        stops: round.stops,
        live: round,
        tracked,
      };
    });
  }, [canLive, live.data, tracking.data]);

  return {
    rounds,
    depot: live.data?.depot ?? tracking.data?.depot ?? null,
    live,
    tracking,
    canLive,
    canTrack,
    /** Première lecture en cours (aucune donnée encore). */
    loading: canLive ? live.isLoading && !live.data : tracking.isLoading && !tracking.data,
    /** Lecture faite : la liste des tournées est connue (éventuellement vide). */
    loaded: canLive ? Boolean(live.data) : Boolean(tracking.data),
    generatedAt: tracking.data?.generatedAt ?? live.data?.generatedAt ?? null,
  };
}
