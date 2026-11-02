import { prisma } from "@/services/prisma/client";
import { queueDeliveryAcceptedNotification } from "@/domains/client-portal/notify.service";
import { kickOperationJob } from "@/domains/operations/operation-job.service";

/** Compare la version présentée par le livreur : protège aussi le cycle A → B → A. */
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
  const result = await prisma.$transaction(async (tx) => {
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
    if (input.action === "accept" && current.missionAcceptedAt) return { delivery: current, notificationJobId: null };

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
        : { status: "PENDING", driverId: null, driverName: null, roundId: null, roundSequence: null,
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
          ? `${current.driverName ?? "Le livreur assigné"} a confirmé la prise en charge, avant le départ.`
          : `${current.driverName ?? "Le livreur assigné"} — ${reason}${current.missionAcceptedAt ? ` — prise en charge précédente : ${current.missionAcceptedAt.toISOString()}` : ""}`,
        occurredAt: now,
      },
    });
    // Le client donneur d'ordre est prévenu de la prise en charge, dans la même transaction.
    const notificationJob = input.action === "accept"
      ? await queueDeliveryAcceptedNotification(tx, {
          customerId: current.customerId,
          companyId,
          reference: current.reference,
          deliveryId,
          acceptedAt: now,
        })
      : null;
    const delivery = await tx.delivery.findUniqueOrThrow({ where: { id: deliveryId } });
    return { delivery, notificationJobId: notificationJob?.id ?? null };
  }, { maxWait: 10_000, timeout: 30_000 });

  if (!result) return null;
  if (result.notificationJobId) kickOperationJob(result.notificationJobId);
  return result.delivery;
}
