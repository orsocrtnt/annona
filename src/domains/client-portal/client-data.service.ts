import { prisma } from "@/services/prisma/client";
import {
  generateDeliveryReference,
  generateOrderReference,
} from "@/lib/order-reference";

export async function linkPortalDataToClient(userId: string, email: string) {
  await prisma.order.updateMany({
    where: { customerEmail: email, customerId: null },
    data: { customerId: userId },
  });

  const orderIds = (
    await prisma.order.findMany({
      where: { customerId: userId },
      select: { id: true },
    })
  ).map((o) => o.id);

  if (orderIds.length === 0) return;

  await prisma.delivery.updateMany({
    where: { orderId: { in: orderIds }, customerId: null },
    data: { customerId: userId },
  });
  await prisma.invoice.updateMany({
    where: { orderId: { in: orderIds }, customerId: null },
    data: { customerId: userId },
  });
}

export async function provisionClientTestData(
  userId: string,
  email: string,
  companyId: string
) {
  const existingOrders = await prisma.order.count({ where: { customerId: userId } });
  if (existingOrders > 0) return;

  const orderReference = await generateOrderReference("STANDARD");
  const deliveryReference = await generateDeliveryReference();

  const order = await prisma.order.create({
    data: {
      reference: orderReference,
      status: "IN_DELIVERY",
      totalAmount: 79.9,
      itemCount: 2,
      companyId,
      customerId: userId,
      customerEmail: email,
      items: {
        create: [
          { name: "Colis test", quantity: 1, unitPrice: 49.9 },
          { name: "Emballage", quantity: 1, unitPrice: 30.0 },
        ],
      },
    },
  });

  await prisma.delivery.create({
    data: {
      reference: deliveryReference,
      status: "IN_DELIVERY",
      address: "15 rue de la Paix",
      city: "Paris",
      postalCode: "75002",
      driverName: "Jean Test",
      estimatedArrival: new Date(Date.now() + 2 * 60 * 60 * 1000),
      companyId,
      orderId: order.id,
      customerId: userId,
      trackingEvents: {
        create: [
          {
            label: "Commande reçue",
            description: "Votre commande de test a été enregistrée",
            latitude: 48.8566,
            longitude: 2.3522,
            occurredAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
          },
          {
            label: "En livraison",
            description: "Le chauffeur est en route",
            latitude: 48.8606,
            longitude: 2.3376,
            occurredAt: new Date(Date.now() - 1 * 60 * 60 * 1000),
          },
        ],
      },
    },
  });

  await prisma.invoice.create({
    data: {
      reference: `FAC-${Date.now().toString().slice(-8)}`,
      status: "PENDING",
      amount: 79.9,
      companyId,
      orderId: order.id,
      customerId: userId,
      dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    },
  });
}
