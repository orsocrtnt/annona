import { Prisma } from "@prisma/client";
import { prisma } from "@/services/prisma/client";

/**
 * Export portable du périmètre d'une entreprise.
 *
 * Les identifiants relationnels sont conservés pour permettre une reprise, mais
 * les identifiants Supabase Auth, clés d'idempotence, empreintes de requête,
 * charges de jobs et erreurs internes sont exclus.
 */
export async function exportCompanyData(companyId: string) {
  const exportedAt = new Date().toISOString();
  const data = await prisma.$transaction(async (tx) => {
    const company = await tx.company.findUnique({
      where: { id: companyId },
      select: {
        id: true,
        name: true,
        slug: true,
        logoUrl: true,
        email: true,
        phone: true,
        address: true,
        city: true,
        country: true,
        status: true,
        isDemo: true,
        settings: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    if (!company) return null;

    const [users, recurringOrders, orders, invoices, supportTickets, operationJobs] =
      await Promise.all([
        tx.user.findMany({
          where: { companyId },
          orderBy: [{ createdAt: "asc" }, { id: "asc" }],
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            phone: true,
            avatarUrl: true,
            settings: true,
            status: true,
            role: { select: { name: true, slug: true, systemRole: true } },
            createdAt: true,
            updatedAt: true,
            lastLoginAt: true,
            addresses: { orderBy: [{ createdAt: "asc" }, { id: "asc" }] },
            driverLocation: true,
            notifications: {
              orderBy: [{ createdAt: "asc" }, { id: "asc" }],
              select: {
                id: true,
                type: true,
                title: true,
                body: true,
                href: true,
                readAt: true,
                orderMessageId: true,
                createdAt: true,
              },
            },
          },
        }),
        tx.recurringOrder.findMany({
          where: { companyId },
          orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        }),
        tx.order.findMany({
          where: { companyId },
          orderBy: [{ createdAt: "asc" }, { id: "asc" }],
          select: {
            id: true,
            companyId: true,
            reference: true,
            status: true,
            source: true,
            totalAmount: true,
            itemCount: true,
            notes: true,
            deliveryCategory: true,
            pickupAddress: true,
            pickupCity: true,
            pickupPostalCode: true,
            pickupInstructions: true,
            shippingAddress: true,
            shippingCity: true,
            shippingPostalCode: true,
            deliveryInstructions: true,
            requestedDeliveryDate: true,
            missionDescription: true,
            customerId: true,
            customerEmail: true,
            recurringOrderId: true,
            createdAt: true,
            updatedAt: true,
            items: { orderBy: { id: "asc" } },
            stops: { orderBy: [{ sequence: "asc" }, { id: "asc" }] },
            deliveries: {
              orderBy: [{ createdAt: "asc" }, { id: "asc" }],
              include: {
                trackingEvents: {
                  orderBy: [{ occurredAt: "asc" }, { id: "asc" }],
                },
              },
            },
            messages: {
              orderBy: [{ createdAt: "asc" }, { id: "asc" }],
              select: {
                id: true,
                authorId: true,
                authorName: true,
                authorRole: true,
                body: true,
                kind: true,
                internal: true,
                createdAt: true,
              },
            },
            threadReads: {
              orderBy: { id: "asc" },
              select: { id: true, userId: true, seenAt: true, seenId: true },
            },
          },
        }),
        tx.invoice.findMany({
          where: { companyId },
          orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        }),
        tx.supportTicket.findMany({
          where: { companyId },
          orderBy: [{ createdAt: "asc" }, { id: "asc" }],
          include: {
            messages: { orderBy: [{ createdAt: "asc" }, { id: "asc" }] },
          },
        }),
        tx.operationJob.findMany({
          where: { companyId },
          orderBy: [{ createdAt: "asc" }, { id: "asc" }],
          select: {
            id: true,
            jobKey: true,
            type: true,
            status: true,
            attempts: true,
            maxAttempts: true,
            nextAttemptAt: true,
            lockedAt: true,
            completedAt: true,
            createdAt: true,
            updatedAt: true,
          },
        }),
      ]);

    return { company, users, recurringOrders, orders, invoices, supportTickets, operationJobs };
  }, {
    isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead,
    maxWait: 10_000,
    timeout: 60_000,
  });

  if (!data) return null;

  const proofObjects = data.orders.flatMap((order) =>
    order.deliveries
      .filter((delivery) => Boolean(delivery.podPhotoPath))
      .map((delivery) => ({
        deliveryId: delivery.id,
        deliveryReference: delivery.reference,
        objectKey: delivery.podPhotoPath!,
      }))
  );
  const counts = {
    users: data.users.length,
    addresses: data.users.reduce((sum, user) => sum + user.addresses.length, 0),
    notifications: data.users.reduce((sum, user) => sum + user.notifications.length, 0),
    recurringOrders: data.recurringOrders.length,
    orders: data.orders.length,
    items: data.orders.reduce((sum, order) => sum + order.items.length, 0),
    stops: data.orders.reduce((sum, order) => sum + order.stops.length, 0),
    deliveries: data.orders.reduce((sum, order) => sum + order.deliveries.length, 0),
    trackingEvents: data.orders.reduce(
      (sum, order) =>
        sum + order.deliveries.reduce((deliverySum, delivery) => deliverySum + delivery.trackingEvents.length, 0),
      0
    ),
    orderMessages: data.orders.reduce((sum, order) => sum + order.messages.length, 0),
    orderThreadReads: data.orders.reduce((sum, order) => sum + order.threadReads.length, 0),
    invoices: data.invoices.length,
    supportTickets: data.supportTickets.length,
    supportMessages: data.supportTickets.reduce((sum, ticket) => sum + ticket.messages.length, 0),
    operationJobs: data.operationJobs.length,
    proofObjects: proofObjects.length,
  };

  return {
    schema: "tutelliv-company-export",
    version: 1,
    exportedAt,
    counts,
    externalAssets: {
      proofObjects,
      note: "Les fichiers binaires doivent être exportés séparément depuis le bucket privé.",
    },
    data,
  };
}
