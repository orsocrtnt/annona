import { NextResponse } from "next/server";
import { requireDriverRole } from "@/lib/api/auth-guard";
import {
  getAvailableDeliveriesForDriver,
  getDriverMissions,
  getDriverStats,
} from "@/domains/delivery/delivery.service";
import { parseDispatchSettings } from "@/domains/company/dispatch-settings.service";
import { deliveryTiming } from "@/domains/delivery/delivery-timing";
import { isPodPhotoPathForDelivery } from "@/lib/storage/pod";

export async function GET() {
  const auth = await requireDriverRole();
  if ("error" in auth) return auth.error;

  const companyId = auth.context.user.companyId;
  if (!companyId) {
    return NextResponse.json({ error: "Entreprise non associée" }, { status: 400 });
  }

  const driverId = auth.context.user.id;
  const raw = (auth.context.user.company?.settings ?? {}) as Record<string, unknown>;
  const dispatchSettings = parseDispatchSettings(raw.dispatchRules);
  const [missions, available, stats] = await Promise.all([
    getDriverMissions(driverId),
    getAvailableDeliveriesForDriver(companyId, dispatchSettings),
    getDriverStats(driverId),
  ]);

  const safeMissions = missions.map((mission) => {
    const { podPhotoPath, ...safeMission } = mission;
    // Même règle de retard que l'équipe et le client (UX-03) ; la prochaine action reste interne.
    const { dueAt, late, lateByMinutes } = deliveryTiming({
      status: mission.status,
      requestedDeliveryDate: mission.order.requestedDeliveryDate,
      completedAt: mission.completedAt,
      driverId: mission.driverId,
      missionAcceptedAt: mission.missionAcceptedAt,
      hasProof: Boolean(podPhotoPath),
    });
    return {
      ...safeMission,
      timing: { dueAt, late, lateByMinutes },
      podPhotoUrl: podPhotoPath && isPodPhotoPathForDelivery(podPhotoPath, companyId, mission.id)
        ? `/api/driver/missions/${encodeURIComponent(mission.id)}/proof` : null,
    };
  });

  return NextResponse.json({ data: { missions: safeMissions, available, stats }, success: true });
}
