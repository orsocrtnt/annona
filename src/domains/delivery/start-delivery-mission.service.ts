import { prisma } from "@/services/prisma/client";

export async function startDeliveryMissionByDriver(
  driverId: string,
  companyId: string,
  deliveryId: string,
  expectedUpdatedAt?: Date
) {
  const delivery = await prisma.delivery.findFirst({
    where: { id: deliveryId, driverId, companyId },
  });
  if (!delivery) return null;
  if (delivery.missionStartedAt) throw new Error("MISSION_ALREADY_STARTED");
  if (expectedUpdatedAt && delivery.updatedAt.getTime() !== expectedUpdatedAt.getTime()) throw new Error("MISSION_START_CONFLICT");
  if (delivery.status !== "ASSIGNED") throw new Error("MISSION_START_CONFLICT");

  if (!delivery.missionAcceptedAt) throw new Error("MISSION_ACCEPTANCE_REQUIRED");

  return prisma.$transaction(
    async (tx) => {
      const now = new Date(Math.max(Date.now(), delivery.updatedAt.getTime() + 1));
      const claimed = await tx.delivery.updateMany({
        where: {
          id: deliveryId,
          driverId,
          companyId,
          status: "ASSIGNED",
          missionStartedAt: null,
          missionAcceptedAt: delivery.missionAcceptedAt,
          updatedAt: delivery.updatedAt,
        },
        data: { missionStartedAt: now, updatedAt: now },
      });

      if (claimed.count !== 1) {
        const current = await tx.delivery.findFirst({
          where: { id: deliveryId, companyId },
          select: { driverId: true, missionStartedAt: true },
        });
        if (current?.driverId === driverId && current.missionStartedAt) {
          throw new Error("MISSION_ALREADY_STARTED");
        }
        throw new Error("MISSION_START_CONFLICT");
      }

      await tx.trackingEvent.create({
        data: {
          deliveryId,
          label: "Mission démarrée",
          description: "Le chauffeur a commencé la mission",
        },
      });

      return tx.delivery.findUniqueOrThrow({
        where: { id: deliveryId },
        include: {
          order: {
            select: {
              reference: true,
              itemCount: true,
              notes: true,
              deliveryInstructions: true,
              customerEmail: true,
              customer: { select: { firstName: true, lastName: true, phone: true } },
              items: { select: { id: true, name: true, quantity: true, unitPrice: true } },
            },
          },
        },
      });
    },
    { maxWait: 10_000, timeout: 30_000 }
  );
}
