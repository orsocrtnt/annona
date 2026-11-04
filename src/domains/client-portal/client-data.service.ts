import { prisma } from "@/services/prisma/client";
import {
  generateDeliveryReference,
  generateOrderReference,
} from "@/lib/order-reference";

/** Rattachement réservé à un client de l'entreprise vérifiée en base. */
export async function linkPortalDataToClient(
  userId: string,
  email: string,
  companyId: string | null
) {
  if (!companyId) return;

  await prisma.$transaction(async (tx) => {
    // Ne pas faire confiance aux seuls arguments fournis par l'appelant.
    const client = await tx.user.findFirst({
      where: {
        id: userId,
        companyId,
        email: { equals: email.trim().toLowerCase(), mode: "insensitive" },
        role: { systemRole: "CLIENT" },
      },
      select: { id: true, email: true, companyId: true },
    });
    if (!client) return;

    const owner = { customerId: client.id, companyId };
    await tx.order.updateMany({
      where: {
        companyId,
        customerEmail: { equals: client.email.trim().toLowerCase(), mode: "insensitive" },
        customerId: null,
      },
      data: { customerId: client.id },
    });

    // MAIL-PONT, étape 4 : la fiche sans accès du même client dans l'entreprise est rattachée au compte.
    await tx.companyCustomer.updateMany({
      where: { companyId, email: client.email.trim().toLowerCase(), userId: null },
      data: { userId: client.id },
    });

    // Vérifier également l'entreprise des objets enfants et de leur commande.
    await tx.delivery.updateMany({
      where: { companyId, customerId: null, order: owner },
      data: { customerId: client.id },
    });
    await tx.invoice.updateMany({
      where: { companyId, customerId: null, order: owner },
      data: { customerId: client.id },
    });
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

  await prisma.$transaction(async (tx) => {
    const order = await tx.order.create({
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

    await tx.delivery.create({
      data: {
        reference: deliveryReference,
        status: "IN_DELIVERY",
        address: "15 rue de la Paix",
        city: "Paris",
        postalCode: "75002",
        latitude: 48.8698,
        longitude: 2.3311,
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
              description: "Le livreur est en route",
              latitude: 48.8606,
              longitude: 2.3376,
              occurredAt: new Date(Date.now() - 1 * 60 * 60 * 1000),
            },
          ],
        },
      },
    });

    await tx.invoice.create({
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
  });
}
