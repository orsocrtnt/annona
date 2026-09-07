import type { DriverMission, DriverStats } from "./types";
import type { ProximityTargetKind } from "@/lib/maps/driver-proximity";
import type { MissionProximityResult } from "@/domains/delivery/driver-proximity.service";

export class DriverApiError extends Error {
  code?: string;
  kind?: ProximityTargetKind;
  distanceMeters?: number | null;

  constructor(message: string, extras?: Partial<DriverApiError>) {
    super(message);
    this.name = "DriverApiError";
    Object.assign(this, extras);
  }
}

export type DriverMissionNavigation = {
  id: string;
  reference: string;
  status: DriverMission["status"];
  deliveryCategory: DriverMission["deliveryCategory"];
  missionStartedAt: string | null;
  pickup: {
    latitude: number;
    longitude: number;
    address: string;
    label: string;
  } | null;
  pickups?: {
    latitude: number;
    longitude: number;
    address: string;
    label: string;
  }[];
  destination: {
    latitude: number;
    longitude: number;
    address: string;
    label: string;
  };
  target: {
    latitude: number;
    longitude: number;
    address: string;
    label: string;
  } | null;
  canNavigate: boolean;
  unavailableReason: string | null;
};

async function fetchJson<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, options);
  const text = await res.text();
  let json: {
    data?: T;
    error?: string;
    code?: string;
    kind?: ProximityTargetKind;
    distanceMeters?: number | null;
  } = {};

  if (text) {
    try {
      json = JSON.parse(text) as typeof json;
    } catch {
      throw new DriverApiError(
        res.ok ? "Réponse serveur invalide" : `Erreur serveur (${res.status})`
      );
    }
  }

  if (!res.ok) {
    throw new DriverApiError(json.error ?? "Erreur serveur", {
      code: json.code,
      kind: json.kind,
      distanceMeters: json.distanceMeters,
    });
  }

  return json.data as T;
}

export const driverApi = {
  getMissions: () =>
    fetchJson<{ missions: DriverMission[]; available: DriverMission[]; stats: DriverStats }>(
      "/api/driver/missions"
    ),
  getMission: (id: string) => fetchJson<DriverMission>(`/api/driver/missions/${id}`),
  getMissionNavigation: (id: string) =>
    fetchJson<DriverMissionNavigation>(`/api/driver/missions/${id}/navigation`),
  checkMissionProximity: (
    id: string,
    kind: ProximityTargetKind,
    position?: { latitude: number; longitude: number } | null
  ) => {
    const params = new URLSearchParams({ kind });
    if (position) {
      params.set("latitude", String(position.latitude));
      params.set("longitude", String(position.longitude));
    }
    return fetchJson<MissionProximityResult>(`/api/driver/missions/${id}/proximity?${params}`);
  },
  claimDelivery: (id: string) =>
    fetchJson<DriverMission>(`/api/driver/deliveries/${id}/claim`, { method: "POST" }),
  startMission: (id: string) =>
    fetchJson<DriverMission>(`/api/driver/missions/${id}/start`, { method: "POST" }),
  updateMissionStatus: (
    id: string,
    status: "PURCHASING" | "IN_DELIVERY" | "DELIVERED" | "FAILED",
    options?: {
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
    }
  ) => {
    if (options?.pod && (status === "DELIVERED" || status === "FAILED")) {
      const form = new FormData();
      form.set("status", status);
      form.set("podOutcome", options.pod.outcome);
      if (options.confirmOutOfRange) form.set("confirmOutOfRange", "true");
      if (options.latitude != null) form.set("latitude", String(options.latitude));
      if (options.longitude != null) form.set("longitude", String(options.longitude));
      if (options.pod.failureCode) form.set("podFailureCode", options.pod.failureCode);
      if (options.pod.note) form.set("podNote", options.pod.note);
      if (options.pod.photo) {
        form.set("photo", options.pod.photo, "proof.jpg");
      }
      return fetchJson<DriverMission>(`/api/driver/missions/${id}`, {
        method: "PATCH",
        body: form,
      });
    }

    return fetchJson<DriverMission>(`/api/driver/missions/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        status,
        purchaseItems: options?.purchaseItems,
        confirmOutOfRange: options?.confirmOutOfRange,
        latitude: options?.latitude,
        longitude: options?.longitude,
      }),
    });
  },
};
