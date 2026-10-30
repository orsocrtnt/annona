import { computeDispatchIncidents, OFF_DUTY_ALERT_MINUTES } from "@/lib/dispatch/dispatch-incidents";
import { trackingService } from "@/domains/tracking/tracking.policy";
import { prisma } from "@/services/prisma/client";

const INCIDENT_SCAN_TAKE = 200;

/** Imprévus de la file : recalculés à chaque lecture, sans rien écrire ni exposer de position. */
export async function getDispatchIncidents(companyId: string, now = new Date(), db: Pick<typeof prisma, "delivery"> = prisma) {
  const horizon = new Date(now.getTime() + OFF_DUTY_ALERT_MINUTES * 60_000);
  const rows = await db.delivery.findMany({
    where: {
      companyId,
      status: { in: ["PENDING", "ASSIGNED", "PURCHASING", "IN_DELIVERY"] },
      completedAt: null,
      OR: [
        { order: { requestedDeliveryDate: { lte: horizon } } },
        { order: { requestedDeliveryDate: null }, scheduledAt: { lte: horizon } },
        { status: "ASSIGNED", driver: { status: { not: "ACTIVE" } } },
      ],
    },
    orderBy: [{ scheduledAt: "asc" }, { createdAt: "asc" }],
    take: INCIDENT_SCAN_TAKE,
    select: {
      id: true,
      reference: true,
      status: true,
      driverId: true,
      driverName: true,
      missionStartedAt: true,
      scheduledAt: true,
      order: { select: { requestedDeliveryDate: true } },
      driver: { select: { status: true, settings: true } },
    },
  });
  return computeDispatchIncidents(
    rows.map((row) => ({
      id: row.id,
      reference: row.reference,
      status: row.status,
      driverId: row.driverId,
      driverName: row.driverName,
      driverActive: row.driver?.status === "ACTIVE",
      driverOnDuty: trackingService(row.driver?.settings).active,
      missionStarted: Boolean(row.missionStartedAt),
      deadline: row.order.requestedDeliveryDate ?? row.scheduledAt,
    })),
    now
  );
}
