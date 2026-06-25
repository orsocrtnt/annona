import { prisma } from "@/services/prisma/client";

export async function startDeliveryMissionByDriver(
  driverId: string,
  deliveryId: string
) {
  const delivery = await prisma.delivery.findFirst({
    where: { id: deliveryId, driverId, status: "ASSIGNED" },
  });
  if (!delivery) return null;
  if (delivery.missionStartedAt) throw new Error("MISSION_ALREADY_STARTED");

  return prisma.$transaction(async (tx) => {
    const updated = await tx.delivery.update({
      where: { id: deliveryId },
      data: { missionStartedAt: new Date() },
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

    await tx.trackingEvent.create({
      data: {
        deliveryId,
        label: "Mission démarrée",
        description: "Le chauffeur a commencé la mission",
      },
    });

    return updated;
  });
}
