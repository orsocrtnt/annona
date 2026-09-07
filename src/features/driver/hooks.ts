"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { driverApi } from "./api";
import { useDriverLocationSettings } from "./location-settings-hooks";

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
    mutationFn: (id: string) => driverApi.startMission(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["driver"] });
      qc.invalidateQueries({ queryKey: ["company"] });
    },
  });
}

export function useClaimDelivery() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => driverApi.claimDelivery(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["driver"] });
      qc.invalidateQueries({ queryKey: ["company"] });
    },
  });
}

export function useUpdateMissionStatus() {
  const qc = useQueryClient();
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
        photo?: Blob | null;
        failureCode?: string;
        note?: string;
      };
    }) =>
      driverApi.updateMissionStatus(id, status, {
        purchaseItems,
        confirmOutOfRange,
        latitude,
        longitude,
        pod,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["driver"] });
    },
  });
}
