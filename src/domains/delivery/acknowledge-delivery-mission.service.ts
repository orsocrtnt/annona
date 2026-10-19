import { prisma } from "@/services/prisma/client";

/** Compare la version présentée par le chauffeur : protège aussi le cycle A → B → A. */
export async function acknowledgeDeliveryMissionByDriver(
  driverId: string,
  companyId: string,
  deliveryId: string,
  input: { action: "accept" | "decline"; expectedUpdatedAt: Date; reason?: string }
) {
  const reason = input.reason?.trim();
  if (input.action === "decline" && (!reason || reason.length > 500)) {
    throw new Error("MISSION_DECLINE_REASON_REQUIRED");
  }
  return prisma.$transaction(async (tx) => {
    const current = await tx.delivery.findFirst({
      where: { id: deliveryId, companyId, driverId },
    });
    if (!current) return null;
    if (current.updatedAt.getTime() !== input.expectedUpdatedAt.getTime()) {
      throw new Error("MISSION_ACK_CONFLICT");
    }
    if (current.status !== "ASSIGNED" || current.missionStartedAt) {
      throw new Error("MISSION_ACK_CONFLICT");
    }
    // Une confirmation de la version actuelle est un rejeu sans nouvel événement.
    if (input.action === "accept" && current.missionAcceptedAt) return current;

    const now = new Date(Math.max(Date.now(), current.updatedAt.getTime() + 1));
    const claim = await tx.delivery.updateMany({
      where: {
        id: deliveryId, companyId, driverId,
        status: "ASSIGNED", missionStartedAt: null,
        missionAcceptedAt: current.missionAcceptedAt,
        updatedAt: input.expectedUpdatedAt,
      },
      data: input.action === "accept"
        ? { missionAcceptedAt: now, updatedAt: now }
        : { status: "PENDING", driverId: null, driverName: null,
            missionAcceptedAt: null, estimatedArrival: null, updatedAt: now },
    });
    if (claim.count !== 1) throw new Error("MISSION_ACK_CONFLICT");
    if (input.action === "decline") {
      const orderClaim = await tx.order.updateMany({
        where: { id: current.orderId, companyId, status: "ASSIGNED" },
        data: { status: "PENDING" },
      });
      if (orderClaim.count !== 1) throw new Error("MISSION_ACK_CONFLICT");
    }
    await tx.trackingEvent.create({
      data: {
        deliveryId,
        label: input.action === "accept" ? "Prise en charge confirmée" : "Mission refusée — retour au dispatch",
        description: input.action === "accept"
          ? `${current.driverName ?? "Le chauffeur assigné"} a confirmé la prise en charge, avant le départ.`
          : `${current.driverName ?? "Le chauffeur assigné"} — ${reason}${current.missionAcceptedAt ? ` — prise en charge précédente : ${current.missionAcceptedAt.toISOString()}` : ""}`,
        occurredAt: now,
      },
    });
    return tx.delivery.findUniqueOrThrow({ where: { id: deliveryId } });
  }, { maxWait: 10_000, timeout: 30_000 });
}
