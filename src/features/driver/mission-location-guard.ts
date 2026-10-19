import { driverApi } from "@/features/driver/api";
import { getCurrentDriverPosition, type DriverPosition, type ProximityTargetKind } from "@/lib/maps/driver-proximity";

export type LocationGuardBlock = {
  kind: ProximityTargetKind;
  distanceMeters: number | null;
};

export type LocationGuardResult =
  | { proceed: true; position: DriverPosition | null }
  | { proceed: false; block: LocationGuardBlock; position: DriverPosition | null };

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
    return { proceed: true, position: browserPosition };
  }

  return {
    proceed: false,
    position: browserPosition,
    block: {
      kind,
      distanceMeters: serverCheck.distanceMeters,
    },
  };
}
