import { NextResponse } from "next/server";
import {
  recordPlatformAccess,
  type PlatformAccessResource,
  type PlatformAccessRole,
} from "@/domains/admin/platform-access.service";

export const PLATFORM_ACCESS_FAILURE_SIGNAL = "Journal d'accès plateforme indisponible.";
export const PLATFORM_ACCESS_UNAVAILABLE = "Supervision temporairement indisponible.";

type PlatformActorContext = { user: { id: string; role: { systemRole: PlatformAccessRole } } };

export async function gatePlatformRead(
  context: PlatformActorContext,
  denied: NextResponse | null,
  resource: PlatformAccessResource,
  dependencies?: Parameters<typeof recordPlatformAccess>[1],
) {
  const recorded = await recordPlatformAccess({
    actorId: context.user.id,
    role: context.user.role.systemRole,
    resource,
    decision: denied ? "DENIED" : "ALLOWED",
  }, dependencies);
  if (!recorded) {
    if (denied) {
      console.error(PLATFORM_ACCESS_FAILURE_SIGNAL);
      return denied;
    }
    return NextResponse.json(
      { error: PLATFORM_ACCESS_UNAVAILABLE },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
  return denied;
}
