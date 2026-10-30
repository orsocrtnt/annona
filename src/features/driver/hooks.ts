"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { driverApi } from "./api";
import { useDriverLocationSettings } from "./location-settings-hooks";
import { useDriverActionQueue } from "./driver-action-queue-provider";
import type { DriverPodPayload } from "./offline-action-queue";
import { readCachedProofRules, writeCachedProofRules } from "./proof-rules-cache";

/** Règles de preuve de l'entreprise (signature requise ou non), mises en cache pour le mode hors ligne. */
export function useDriverProofRules() {
  return useQuery({
    queryKey: ["driver", "proof-rules"],
    queryFn: async () => {
      const rules = await driverApi.getProofRules();
      writeCachedProofRules(rules);
      return rules;
    },
    // Dernière règle connue sur ce téléphone : rechargée dès que le réseau le permet.
    initialData: readCachedProofRules,
    initialDataUpdatedAt: 0,
    staleTime: 10 * 60_000,
    gcTime: 24 * 60 * 60_000,
  });
}

export function useDriverMissions() {
  const { data: locationSettings } = useDriverLocationSettings();
  const refetchMs = (locationSettings?.idleIntervalSeconds ?? 15) * 1000;

  return useQuery({
    queryKey: ["driver", "missions"],
    queryFn: driverApi.getMissions,
    refetchInterval: refetchMs,
  });
}

export function useDriverMission(id: string) {
  return useQuery({
    queryKey: ["driver", "missions", id],
    queryFn: () => driverApi.getMission(id),
    enabled: !!id,
  });
}

export function useDriverMissionNavigation(id: string) {
  return useQuery({
    queryKey: ["driver", "missions", id, "navigation"],
    queryFn: () => driverApi.getMissionNavigation(id),
    enabled: !!id,
  });
}

export function useStartMission() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, expectedUpdatedAt }: { id: string; expectedUpdatedAt: string }) => driverApi.startMission(id, expectedUpdatedAt),
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["driver"] });
      qc.invalidateQueries({ queryKey: ["company"] });
    },
  });
}

export function useClaimDelivery() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => driverApi.claimDelivery(id),
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["driver"] });
      qc.invalidateQueries({ queryKey: ["company"] });
    },
  });
}

export function useUpdateMissionStatus() {
  const qc = useQueryClient();
  const actionQueue = useDriverActionQueue();
  return useMutation({
    mutationFn: ({
      id,
      status,
      purchaseItems,
      confirmOutOfRange,
      latitude,
      longitude,
      pod,
    }: {
      id: string;
      status: "PURCHASING" | "IN_DELIVERY" | "DELIVERED" | "FAILED";
      purchaseItems?: { id: string; unitPrice: number }[];
      confirmOutOfRange?: boolean;
      latitude?: number;
      longitude?: number;
      pod?: DriverPodPayload;
    }) =>
      actionQueue.submit(id, {
        status,
        purchaseItems,
        confirmOutOfRange,
        latitude,
        longitude,
        pod,
      }),
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["driver"] });
    },
  });
}

export function useAcknowledgeMission() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...input }: { id: string; action: "accept" | "decline"; expectedUpdatedAt: string; reason?: string }) => driverApi.acknowledgeMission(id, input),
    onSettled: async () => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["driver"] }),
        qc.invalidateQueries({ queryKey: ["company"] }),
      ]);
    },
  });
}
