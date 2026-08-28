import { prisma } from "@/services/prisma/client";
import type { DeliveryStatus, OrderSource, OrderStatus } from "@prisma/client";
import type { CreateClientOrderInput } from "@/lib/validations/order";
import { createClientAddress } from "@/domains/client-portal/address.service";
import { resolveCustomersByEmail } from "@/domains/order/resolve-customer";
import {
  ACTIVE_ORDER_STATUSES,
  FULFILLMENT_STATUS_LABELS,
  getFulfillmentStatusLabel,
  HISTORY_ORDER_STATUSES,
} from "@/lib/constants/order-status";
import {
  generateDeliveryReference,
  generateOrderReference,
} from "@/lib/order-reference";
import { formatStopAddress, getPrimaryCourierPickupFields } from "@/lib/order/courier-pickups";
import { buildReorderFormValues } from "@/lib/order/reorder-template";
import {
  resolveDeliveryCoordinateFields,
  resolveStopCoordinates,
} from "@/domains/delivery/delivery-coordinates";
import { CLIENT_ORDERS_TAKE, COMPANY_ORDERS_TAKE } from "@/lib/query/list-limits";

type CreateOrderOptions = CreateClientOrderInput & {
  recurringOrderId?: string;
  source?: OrderSource;
};

export async function getClientOrders(
  customerId: string,
  options?: { history?: boolean }
) {
  const historyStatuses = HISTORY_ORDER_STATUSES;
  return prisma.order.findMany({
    where: {
      customerId,
      status: options?.history
        ? { in: historyStatuses }
        : { notIn: historyStatuses },
    },
    select: {
      id: true,
      reference: true,
      status: true,
      source: true,
      totalAmount: true,
      itemCount: true,
      createdAt: true,
      deliveryCategory: true,
      shippingAddress: true,
      shippingCity: true,
      shippingPostalCode: true,
      deliveries: { select: { id: true, reference: true, status: true } },
    },
    orderBy: { createdAt: "desc" },
    take: CLIENT_ORDERS_TAKE,
  });
}

export async function getClientOrderById(customerId: string, orderId: string) {
  return prisma.order.findFirst({
    where: { id: orderId, customerId },
    include: {
      items: true,
      stops: { orderBy: { sequence: "asc" }, include: { items: true } },
      deliveries: {
        include: {
          trackingEvents: { orderBy: { occurredAt: "asc" } },
        },
      },
      invoices: true,
      company: { select: { name: true } },
    },
  });
}

export async function getDeliveryReorderTemplate(customerId: string, deliveryId: string) {
  const delivery = await prisma.delivery.findFirst({
    where: { id: deliveryId, customerId },
    select: {
      id: true,
      reference: true,
      orderId: true,
      deliveryCategory: true,
    },
  });

  if (!delivery) return null;

  const order = await getClientOrderById(customerId, delivery.orderId);
  if (!order) return null;

  return {
    deliveryId: delivery.id,
    deliveryReference: delivery.reference,
    formValues: buildReorderFormValues(order),
  };
}

export async function getOrderReorderTemplate(customerId: string, orderId: string) {
  const order = await getClientOrderById(customerId, orderId);
  if (!order) return null;
  if (order.deliveryCategory === "SPECIAL_MISSION" || order.status === "CANCELLED") {
    return null;
  }

  const delivery = order.deliveries[0];

  return {
    orderId: order.id,
    orderReference: order.reference,
    deliveryId: delivery?.id ?? null,
    deliveryReference: delivery?.reference ?? order.reference,
    formValues: buildReorderFormValues(order),
  };
}

export async function getClientOrderStats(customerId: string) {
  const [active, inDelivery, deliveredThisMonth, nextDelivery] = await Promise.all([
    prisma.order.count({
      where: {
        customerId,
        status: { in: ACTIVE_ORDER_STATUSES },
      },
    }),
    prisma.delivery.count({
      where: {
        customerId,
        status: { in: ["ASSIGNED", "PURCHASING", "IN_DELIVERY"] },
      },
    }),
    prisma.order.count({
      where: {
        customerId,
        status: "DELIVERED",
        updatedAt: { gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1) },
      },
    }),
    prisma.delivery.findFirst({
      where: {
        customerId,
        status: { in: ["ASSIGNED", "PURCHASING", "IN_DELIVERY", "PENDING"] },
        estimatedArrival: { not: null },
      },
      orderBy: { estimatedArrival: "asc" },
      select: { estimatedArrival: true },
    }),
  ]);

  return {
    activeOrders: active,
    inDelivery,
    deliveredThisMonth,
    nextDeliveryEta: nextDelivery?.estimatedArrival ?? null,
  };
}

export async function getClientOrderCount(customerId: string) {
  return prisma.order.count({ where: { customerId } });
}

export async function createClientOrder(
  customerId: string,
  companyId: string,
  email: string,
  input: CreateOrderOptions
) {
  const deliveryCategory = input.deliveryCategory ?? "STANDARD";

  if (deliveryCategory === "SPECIAL_MISSION") {
    const stops = input.stops ?? [];
    const firstStop = stops[0];
    const orderReference = await generateOrderReference("SPECIAL_MISSION");

    const stopCoords = await Promise.all(
      stops.map((stop) =>
        resolveStopCoordinates({
          address: stop.address,
          city: stop.city,
          postalCode: stop.postalCode,
        })
      )
    );

    const order = await prisma.order.create({
      data: {
        reference: orderReference,
        status: "QUOTE_REQUESTED",
        source: input.source ?? "CLIENT",
        totalAmount: 0,
        itemCount: 0,
        notes: input.notes ?? null,
        missionDescription: input.missionDescription?.trim() ?? null,
        deliveryCategory: "SPECIAL_MISSION",
        shippingAddress: firstStop?.address ?? null,
        shippingCity: firstStop?.city ?? null,
        shippingPostalCode: firstStop?.postalCode ?? null,
        requestedDeliveryDate: input.requestedDeliveryDate
          ? new Date(input.requestedDeliveryDate)
          : null,
        companyId,
        customerId,
        customerEmail: email,
        stops: {
          create: stops.map((stop, index) => ({
            sequence: index,
            label: stop.label?.trim() || `Adresse ${index + 1}`,
            address: stop.address,
            city: stop.city ?? null,
            postalCode: stop.postalCode ?? null,
            instructions: stop.instructions ?? null,
            latitude: stopCoords[index]?.latitude ?? null,
            longitude: stopCoords[index]?.longitude ?? null,
          })),
        },
      },
      include: { stops: { orderBy: { sequence: "asc" } } },
    });

    return order;
  }

  const isCourier = deliveryCategory === "COURIER";
  const pickupStops = isCourier ? (input.pickupStops ?? []) : [];
  const firstPickup = pickupStops[0];

  const totalAmount = isCourier
    ? pickupStops.flatMap((stop) => stop.items ?? []).reduce(
        (sum, item) => sum + item.quantity * (item.estimatedPrice ?? 0),
        0
      )
    : input.items.reduce(
        (sum, item) => sum + item.quantity * (item.estimatedPrice ?? 0),
        0
      );
  const itemCount = isCourier
    ? pickupStops.flatMap((stop) => stop.items ?? []).reduce((sum, item) => sum + item.quantity, 0)
    : input.items.reduce((sum, item) => sum + item.quantity, 0);
  const orderReference = await generateOrderReference(deliveryCategory);
  const deliveryReference = await generateDeliveryReference();

  const pickupStopCoords =
    isCourier && pickupStops.length > 0
      ? await Promise.all(
          pickupStops.map((stop) =>
            resolveStopCoordinates({
              address: stop.address,
              city: stop.city,
              postalCode: stop.postalCode,
            })
          )
        )
      : [];

  const order = await prisma.order.create({
    data: {
      reference: orderReference,
      status: "PENDING",
      source: input.source ?? (input.recurringOrderId ? "RECURRING" : "CLIENT"),
      totalAmount,
      itemCount,
      notes: input.notes,
      deliveryCategory,
      pickupAddress: isCourier
        ? (firstPickup?.address ?? input.pickupAddress ?? null)
        : (input.pickupAddress ?? null),
      pickupCity: isCourier
        ? (firstPickup?.city ?? input.pickupCity ?? null)
        : (input.pickupCity ?? null),
      pickupPostalCode: isCourier
        ? (firstPickup?.postalCode ?? input.pickupPostalCode ?? null)
        : (input.pickupPostalCode ?? null),
      pickupInstructions: isCourier
        ? (firstPickup?.instructions ?? input.pickupInstructions ?? null)
        : (input.pickupInstructions ?? null),
      shippingAddress: input.shippingAddress!,
      shippingCity: input.shippingCity!,
      shippingPostalCode: input.shippingPostalCode!,
      deliveryInstructions: input.deliveryInstructions,
      requestedDeliveryDate: input.requestedDeliveryDate
        ? new Date(input.requestedDeliveryDate)
        : null,
      companyId,
      customerId,
      customerEmail: email,
      recurringOrderId: input.recurringOrderId,
      items: isCourier
        ? undefined
        : {
            create: input.items.map((item) => ({
              name: item.name,
              quantity: item.quantity,
              unitPrice: item.estimatedPrice ?? 0,
            })),
          },
      stops:
        isCourier && pickupStops.length > 0
          ? {
              create: pickupStops.map((stop, index) => ({
                sequence: index,
                label: stop.label?.trim() || `Collecte ${index + 1}`,
                address: stop.address,
                city: stop.city ?? null,
                postalCode: stop.postalCode ?? null,
                instructions: stop.instructions ?? null,
                latitude: pickupStopCoords[index]?.latitude ?? null,
                longitude: pickupStopCoords[index]?.longitude ?? null,
              })),
            }
          : undefined,
    },
    include: { items: true, stops: { orderBy: { sequence: "asc" } } },
  });

  if (isCourier && pickupStops.length > 0 && order.stops.length > 0) {
    const itemRows = order.stops.flatMap((stop) => {
      const stopInput = pickupStops[stop.sequence];
      return (stopInput?.items ?? [])
        .filter((item) => item.name.trim().length > 0)
        .map((item) => ({
        orderId: order.id,
        orderStopId: stop.id,
        name: item.name,
        quantity: item.quantity,
        unitPrice: item.estimatedPrice ?? 0,
      }));
    });

    if (itemRows.length > 0) {
      await prisma.orderItem.createMany({ data: itemRows });
    }

    order.items = await prisma.orderItem.findMany({ where: { orderId: order.id } });
  }

  const isCourierDelivery = isCourier;
  const primaryPickup = isCourier ? getPrimaryCourierPickupFields(pickupStops) : null;

  const deliveryCoords = await resolveDeliveryCoordinateFields({
    address: input.shippingAddress,
    city: input.shippingCity,
    postalCode: input.shippingPostalCode,
    pickupAddress: isCourier
      ? primaryPickup?.pickupAddress ?? null
      : (input.pickupAddress ?? null),
    pickupCity: isCourier
      ? primaryPickup?.pickupCity ?? null
      : (input.pickupCity ?? null),
    pickupPostalCode: isCourier
      ? primaryPickup?.pickupPostalCode ?? null
      : (input.pickupPostalCode ?? null),
    includePickup: isCourier,
  });

  const delivery = await prisma.delivery.create({
    data: {
      reference: deliveryReference,
      status: "PENDING",
      deliveryCategory,
      pickupAddress: isCourier
        ? primaryPickup?.pickupAddress ?? null
        : (input.pickupAddress ?? null),
      pickupCity: isCourier
        ? primaryPickup?.pickupCity ?? null
        : (input.pickupCity ?? null),
      pickupPostalCode: isCourier
        ? primaryPickup?.pickupPostalCode ?? null
        : (input.pickupPostalCode ?? null),
      pickupLatitude: deliveryCoords.pickupLatitude,
      pickupLongitude: deliveryCoords.pickupLongitude,
      address: input.shippingAddress!,
      city: input.shippingCity!,
      postalCode: input.shippingPostalCode!,
      latitude: deliveryCoords.latitude,
      longitude: deliveryCoords.longitude,
      companyId,
      orderId: order.id,
      customerId,
      scheduledAt: input.requestedDeliveryDate
        ? new Date(input.requestedDeliveryDate)
        : new Date(Date.now() + 48 * 60 * 60 * 1000),
      trackingEvents: {
        create: isCourierDelivery
          ? (() => {
              const baseTime = Date.now();
              return [
                {
                  label: "Commande coursier reçue",
                  description: "Collecte et livraison programmées",
                  occurredAt: new Date(baseTime),
                },
                ...pickupStops.map((stop, index) => ({
                  label:
                    pickupStops.length > 1
                      ? `Collecte ${index + 1}`
                      : "Collecte",
                  description: formatStopAddress(stop),
                  occurredAt: new Date(baseTime + (index + 1) * 1000),
                })),
                {
                  label: "Livraison",
                  description: [input.shippingAddress, input.shippingPostalCode, input.shippingCity]
                    .filter(Boolean)
                    .join(", "),
                  occurredAt: new Date(baseTime + (pickupStops.length + 1) * 1000),
                },
              ];
            })()
          : [
              {
                label: "Commande reçue",
                description: "Votre commande a été enregistrée",
              },
              {
                label: "En préparation",
                description: "Préparation au centre de tri",
              },
            ],
      },
    },
  });

  if (input.saveAddress && input.addressLabel) {
    await createClientAddress(customerId, {
      label: input.addressLabel,
      address: input.shippingAddress!,
      city: input.shippingCity!,
      postalCode: input.shippingPostalCode!,
    });
  }

  const { tryAutoAssignDelivery } = await import(
    "@/domains/delivery/auto-dispatch.service"
  );
  void tryAutoAssignDelivery(companyId, delivery.id).catch((error) => {
    console.error("Auto-dispatch failed for delivery", delivery.id, error);
  });

  return order;
}

export async function getCompanyOrders(companyId: string) {
  const orders = await prisma.order.findMany({
    where: { companyId },
    select: {
      id: true,
      reference: true,
      status: true,
      source: true,
      totalAmount: true,
      itemCount: true,
      createdAt: true,
      requestedDeliveryDate: true,
      deliveryCategory: true,
      customerEmail: true,
      customer: { select: { firstName: true, lastName: true, email: true } },
      deliveries: {
        select: {
          id: true,
          reference: true,
          status: true,
          driverId: true,
          driverName: true,
          driver: { select: { id: true, firstName: true, lastName: true } },
        },
      },
    },
    orderBy: { createdAt: "desc" },
    take: COMPANY_ORDERS_TAKE,
  });

  return resolveCustomersByEmail(orders);
}

export async function getCompanyOrderById(companyId: string, orderId: string) {
  return prisma.order.findFirst({
    where: { id: orderId, companyId },
    include: {
      items: true,
      stops: { orderBy: { sequence: "asc" }, include: { items: true } },
      customer: { select: { id: true, firstName: true, lastName: true, email: true, phone: true } },
      deliveries: {
        include: {
          driver: { select: { id: true, firstName: true, lastName: true, phone: true } },
          trackingEvents: { orderBy: { occurredAt: "asc" } },
        },
      },
      invoices: {
        select: {
          id: true,
          reference: true,
          status: true,
          amount: true,
          lineItems: true,
          dueDate: true,
          paidAt: true,
          createdAt: true,
          notes: true,
        },
      },
    },
  });
}

export async function getCompanyOrderStats(companyId: string) {
  const [pendingOrders, activeDeliveries, deliveredToday, unassigned] = await Promise.all([
    prisma.order.count({
      where: { companyId, status: "PENDING" },
    }),
    prisma.delivery.count({
      where: { companyId, status: { in: ["ASSIGNED", "PURCHASING", "IN_DELIVERY"] } },
    }),
    prisma.delivery.count({
      where: {
        companyId,
        status: "DELIVERED",
        completedAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) },
      },
    }),
    prisma.delivery.count({
      where: { companyId, status: "PENDING" },
    }),
  ]);

  return { pendingOrders, activeDeliveries, deliveredToday, unassigned };
}

function syncDeliveryStatus(orderStatus: OrderStatus): DeliveryStatus {
  return orderStatus as DeliveryStatus;
}

export async function updateCompanyOrderStatus(
  companyId: string,
  orderId: string,
  status: OrderStatus
) {
  const order = await prisma.order.findFirst({
    where: { id: orderId, companyId },
    include: {
      deliveries: true,
      invoices: true,
      stops: { orderBy: { sequence: "asc" } },
    },
  });
  if (!order) return null;

  const acceptingQuote =
    order.status === "QUOTE_REQUESTED" &&
    status === "PENDING" &&
    order.deliveryCategory === "SPECIAL_MISSION" &&
    order.deliveries.length === 0;

  return prisma.$transaction(async (tx) => {
    const updated = await tx.order.update({
      where: { id: orderId },
      data: { status },
      include: {
        items: true,
        stops: { orderBy: { sequence: "asc" } },
        customer: { select: { id: true, firstName: true, lastName: true, email: true, phone: true } },
        deliveries: {
          include: {
            driver: { select: { id: true, firstName: true, lastName: true, phone: true } },
          },
        },
      },
    });

    if (acceptingQuote) {
      const stops = order.stops;
      const firstStop = stops[0];
      const lastStop = stops[stops.length - 1] ?? firstStop;
      const deliveryReference = await generateDeliveryReference();

      const deliveryCoords = await resolveDeliveryCoordinateFields({
        address: lastStop?.address ?? order.shippingAddress ?? "",
        city: lastStop?.city ?? order.shippingCity,
        postalCode: lastStop?.postalCode ?? order.shippingPostalCode,
        pickupAddress: stops.length > 1 ? firstStop?.address ?? null : null,
        pickupCity: stops.length > 1 ? firstStop?.city ?? null : null,
        pickupPostalCode: stops.length > 1 ? firstStop?.postalCode ?? null : null,
        includePickup: stops.length > 1,
      });

      const delivery = await tx.delivery.create({
        data: {
          reference: deliveryReference,
          status: "PENDING",
          deliveryCategory: "SPECIAL_MISSION",
          pickupAddress: stops.length > 1 ? firstStop?.address ?? null : null,
          pickupCity: stops.length > 1 ? firstStop?.city ?? null : null,
          pickupPostalCode: stops.length > 1 ? firstStop?.postalCode ?? null : null,
          pickupLatitude: deliveryCoords.pickupLatitude,
          pickupLongitude: deliveryCoords.pickupLongitude,
          address: lastStop?.address ?? order.shippingAddress ?? "",
          city: lastStop?.city ?? order.shippingCity,
          postalCode: lastStop?.postalCode ?? order.shippingPostalCode,
          latitude: deliveryCoords.latitude,
          longitude: deliveryCoords.longitude,
          companyId,
          orderId: order.id,
          customerId: order.customerId,
          scheduledAt:
            order.requestedDeliveryDate ??
            new Date(Date.now() + 48 * 60 * 60 * 1000),
          trackingEvents: {
            create: [
              {
                label: "Devis accepté",
                description: "Mission spéciale confirmée — en attente d'assignation",
              },
            ],
          },
        },
      });

      const { tryAutoAssignDelivery } = await import(
        "@/domains/delivery/auto-dispatch.service"
      );
      void tryAutoAssignDelivery(companyId, delivery.id).catch((error) => {
        console.error("Auto-dispatch failed for special mission", delivery.id, error);
      });
    }

    for (const delivery of order.deliveries) {
      const deliveryUpdate: {
        status: DeliveryStatus;
        completedAt?: Date | null;
        driverId?: null;
        driverName?: null;
      } = {
        status: syncDeliveryStatus(status),
        completedAt:
          status === "DELIVERED"
            ? delivery.completedAt ?? new Date()
            : delivery.completedAt,
      };
      if (status === "CANCELLED") {
        deliveryUpdate.driverId = null;
        deliveryUpdate.driverName = null;
      }
      await tx.delivery.update({
        where: { id: delivery.id },
        data: deliveryUpdate,
      });
      await tx.trackingEvent.create({
        data: {
          deliveryId: delivery.id,
          label: getFulfillmentStatusLabel(status, order.deliveryCategory),
          description: "Statut mis à jour par l'administrateur",
        },
      });
    }

    if (status === "CANCELLED") {
      await tx.invoice.updateMany({
        where: { orderId },
        data: { status: "CANCELLED" },
      });
    }

    if (status === "INVOICED") {
      await tx.invoice.updateMany({
        where: { orderId },
        data: { status: "PENDING" },
      });
    }
    if (status === "PAID") {
      await tx.invoice.updateMany({
        where: { orderId },
        data: { status: "PAID", paidAt: new Date() },
      });
    }

    if (acceptingQuote) {
      return tx.order.findFirst({
        where: { id: orderId },
        include: {
          items: true,
          stops: { orderBy: { sequence: "asc" } },
          customer: { select: { id: true, firstName: true, lastName: true, email: true, phone: true } },
          deliveries: {
            include: {
              driver: { select: { id: true, firstName: true, lastName: true, phone: true } },
            },
          },
        },
      });
    }

    return updated;
  });
}

export async function deleteCompanyOrder(companyId: string, orderId: string) {
  const order = await prisma.order.findFirst({
    where: { id: orderId, companyId },
    select: { id: true, reference: true },
  });
  if (!order) return null;

  await prisma.order.delete({ where: { id: orderId } });
  return order;
}

export const ORDER_STATUS_LABELS = FULFILLMENT_STATUS_LABELS;
