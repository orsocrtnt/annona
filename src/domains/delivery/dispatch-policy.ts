import type { DeliveryStatus } from "@prisma/client";

export type DispatchSnapshot = {
  status: DeliveryStatus;
  driverId: string | null;
  missionStartedAt: Date | string | null;
};

export type DispatchConflictCode =
  | "DELIVERY_CANCELLED"
  | "DELIVERY_MISSION_STARTED"
  | "DELIVERY_NOT_ASSIGNABLE"
  | "DELIVERY_NOT_CANCELLABLE"
  | "DELIVERY_STATUS_CONFLICT"
  | "CANCELLATION_REASON_REQUIRED";

const ACTIVE_MISSION_STATUSES: DeliveryStatus[] = ["PURCHASING", "IN_DELIVERY"];
const TERMINAL_STATUSES: DeliveryStatus[] = [
  "DELIVERED",
  "FAILED",
  "INVOICED",
  "PAID",
];

export function getAssignmentBlockReason(
  delivery: DispatchSnapshot
): DispatchConflictCode | null {
  if (delivery.status === "CANCELLED") return "DELIVERY_CANCELLED";
  if (delivery.missionStartedAt || ACTIVE_MISSION_STATUSES.includes(delivery.status)) {
    return "DELIVERY_MISSION_STARTED";
  }
  if (TERMINAL_STATUSES.includes(delivery.status)) return "DELIVERY_NOT_ASSIGNABLE";
  if (delivery.status === "PENDING" && delivery.driverId) {
    return "DELIVERY_STATUS_CONFLICT";
  }
  if (delivery.status === "ASSIGNED" && !delivery.driverId) {
    return "DELIVERY_STATUS_CONFLICT";
  }
  if (delivery.status !== "PENDING" && delivery.status !== "ASSIGNED") {
    return "DELIVERY_NOT_ASSIGNABLE";
  }
  return null;
}

export function getUnassignmentBlockReason(
  delivery: DispatchSnapshot
): DispatchConflictCode | null {
  if (delivery.status === "PENDING" && !delivery.driverId && !delivery.missionStartedAt) {
    return null;
  }
  if (delivery.missionStartedAt || ACTIVE_MISSION_STATUSES.includes(delivery.status)) {
    return "DELIVERY_MISSION_STARTED";
  }
  if (delivery.status !== "ASSIGNED" || !delivery.driverId) {
    return "DELIVERY_NOT_ASSIGNABLE";
  }
  return null;
}

export function getCancellationBlockReason(
  delivery: DispatchSnapshot,
  reason?: string | null
): DispatchConflictCode | null {
  if (delivery.status === "CANCELLED") return null;
  if (TERMINAL_STATUSES.includes(delivery.status)) return "DELIVERY_NOT_CANCELLABLE";
  if (
    (delivery.missionStartedAt || ACTIVE_MISSION_STATUSES.includes(delivery.status)) &&
    !reason?.trim()
  ) {
    return "CANCELLATION_REASON_REQUIRED";
  }
  if (
    delivery.status !== "PENDING" &&
    delivery.status !== "ASSIGNED" &&
    !ACTIVE_MISSION_STATUSES.includes(delivery.status)
  ) {
    return "DELIVERY_NOT_CANCELLABLE";
  }
  return null;
}
