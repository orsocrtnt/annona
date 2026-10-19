"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { driverApi } from "./api";
import { useDriverLocationSettings } from "./location-settings-hooks";
import { useDriverActionQueue } from "./driver-action-queue-provider";
import type { PodFailureCode } from "@/lib/pod/codes";

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
      pod?: {
        outcome: "SUCCESS" | "FAILED";
        photo: Blob | null;
        failureCode?: PodFailureCode;
        note?: string;
      };
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
