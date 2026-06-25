import { driverApi } from "@/features/driver/api";
import { getCurrentDriverPosition, type ProximityTargetKind } from "@/lib/maps/driver-proximity";

export type LocationGuardBlock = {
  kind: ProximityTargetKind;
  distanceMeters: number | null;
};

export type LocationGuardResult =
  | { proceed: true }
  | { proceed: false; block: LocationGuardBlock };

export async function checkMissionLocationProximity(
  missionId: string,
  kind: ProximityTargetKind
): Promise<LocationGuardResult> {
  const browserPosition = await getCurrentDriverPosition();

  const serverCheck = await driverApi.checkMissionProximity(
    missionId,
    kind,
    browserPosition
  );

  if (serverCheck.near) {
    return { proceed: true };
  }

  return {
    proceed: false,
    block: {
      kind,
      distanceMeters: serverCheck.distanceMeters,
    },
  };
}
