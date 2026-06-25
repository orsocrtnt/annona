import type { DriverMission } from "./types";

export function canNavigateMission(mission: DriverMission): boolean {
  if (!mission.missionStartedAt) return false;

  if (mission.deliveryCategory === "COURIER") {
    return mission.status === "ASSIGNED" || mission.status === "PURCHASING" || mission.status === "IN_DELIVERY";
  }

  return mission.status === "IN_DELIVERY";
}
