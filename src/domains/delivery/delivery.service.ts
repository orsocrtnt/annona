import { prisma } from "@/services/prisma/client";
import type { DeliveryCategory, DeliveryStatus, OrderStatus } from "@prisma/client";
import type { AdminUpdateDeliveryInput } from "@/lib/validations/delivery";
import { getCompanyDispatchSettings } from "@/domains/company/dispatch-settings.service";
import { getCompanyTariffSettings } from "@/domains/company/tariff-settings.service";
import {
  formatEligibilityReasons,
  getDriverEligibilityReasons,
  isOnlySoftIneligibility,
} from "@/lib/dispatch/driver-eligibility";
import {
  FULFILLMENT_STATUS_LABELS,
  getFulfillmentStatusLabel,
} from "@/lib/constants/order-status";
import { formatDriverDisplayName } from "@/lib/format/person-labels";
import {
  assertDriverMissionProximityOrThrow,
  statusNeedsProximityCheck,
} from "@/domains/delivery/driver-proximity.service";
import { resolveCustomersByEmail } from "@/domains/order/resolve-customer";
import { resolveDeliveryCoordinateFields } from "@/domains/delivery/delivery-coordinates";
import {
  CLIENT_DELIVERIES_TAKE,
  COMPANY_DELIVERIES_TAKE,
  DRIVER_ACTIVE_MISSIONS_TAKE,
  DRIVER_AVAILABLE_TAKE,
  DRIVER_DELIVERED_MISSIONS_TAKE,
  DRIVER_TODAY_EVENTS_TAKE,
} from "@/lib/query/list-limits";

const LIVE_DELIVERY_STATUSES: DeliveryStatus[] = [
  "PENDING",
  "ASSIGNED",
  "PURCHASING",
  "IN_DELIVERY",
];

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function addDays(date: Date, days: number) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

type CategoryCounts = { standard: number; courier: number };

function emptyCategoryCounts(): CategoryCounts {
  return { standard: 0, courier: 0 };
}

function bumpCategory(counts: CategoryCounts, category: DeliveryCategory, n = 1) {
  if (category === "COURIER") counts.courier += n;
  else counts.standard += n;
}

export async function getClientDeliveries(
  customerId: string,
  options?: { take?: number }
) {
  return prisma.delivery.findMany({
    where: { customerId },
    select: {
      id: true,
      reference: true,
      status: true,
      deliveryCategory: true,
      address: true,
      city: true,
      postalCode: true,
      pickupAddress: true,
      pickupCity: true,
      pickupPostalCode: true,
      estimatedArrival: true,
      createdAt: true,
      order: { select: { reference: true, status: true } },
    },
    orderBy: { createdAt: "desc" },
    take: options?.take ?? CLIENT_DELIVERIES_TAKE,
  });
}

/** Corrige les livraisons courses créées sans pickup sur Delivery ni étape « Livraison » au suivi. */
export async function repairCourierDeliveryIfNeeded(deliveryId: string, customerId?: string) {
  const delivery = await prisma.delivery.findFirst({
    where: {
      id: deliveryId,
      ...(customerId ? { customerId } : {}),
    },
    include: {
      order: {
        include: {
          stops: { orderBy: { sequence: "asc" } },
        },
      },
      trackingEvents: { orderBy: { occurredAt: "asc" } },
    },
  });

  if (!delivery || delivery.deliveryCategory !== "COURIER") return;

  const firstStop = delivery.order.stops[0];
  const pickupUpdate =
    firstStop && !delivery.pickupAddress?.trim()
      ? {
          pickupAddress: firstStop.address,
          pickupCity: firstStop.city,
          pickupPostalCode: firstStop.postalCode,
          ...(firstStop.latitude != null && firstStop.longitude != null
            ? {
                pickupLatitude: firstStop.latitude,
                pickupLongitude: firstStop.longitude,
              }
            : {}),
        }
      : null;

  const hasDeliveryStep = delivery.trackingEvents.some((event) => event.label === "Livraison");
  const collecteEvents = delivery.trackingEvents.filter((event) =>
    event.label.startsWith("Collecte")
  );
  const livraisonOccurredAt = new Date(
    (collecteEvents.at(-1)?.occurredAt ?? delivery.createdAt).getTime() + 1000
  );

  const livraisonEvent = delivery.trackingEvents.find((event) => event.label === "Livraison");
  const lastCollecte = collecteEvents.at(-1);
  const livraisonNeedsReorder =
    livraisonEvent &&
    lastCollecte &&
    livraisonEvent.occurredAt.getTime() <= lastCollecte.occurredAt.getTime();

  if (!pickupUpdate && hasDeliveryStep && !livraisonNeedsReorder) return;

  await prisma.$transaction(async (tx) => {
    if (pickupUpdate) {
      await tx.delivery.update({
        where: { id: deliveryId },
        data: pickupUpdate,
      });
    }

    if (!hasDeliveryStep) {
      await tx.trackingEvent.create({
        data: {
          deliveryId,
          label: "Livraison",
          description: [delivery.address, delivery.postalCode, delivery.city]
            .filter(Boolean)
            .join(", "),
          occurredAt: livraisonOccurredAt,
        },
      });
    } else if (livraisonNeedsReorder && livraisonEvent) {
      await tx.trackingEvent.update({
        where: { id: livraisonEvent.id },
        data: { occurredAt: livraisonOccurredAt },
      });
    }
  });
}

export async function getClientDeliveryById(customerId: string, deliveryId: string) {
  await repairCourierDeliveryIfNeeded(deliveryId, customerId);

  return prisma.delivery.findFirst({
    where: { id: deliveryId, customerId },
    include: {
      order: {
        select: {
          reference: true,
          totalAmount: true,
          status: true,
          deliveryCategory: true,
          shippingAddress: true,
          shippingCity: true,
          shippingPostalCode: true,
          deliveryInstructions: true,
          pickupAddress: true,
          pickupCity: true,
          pickupPostalCode: true,
          pickupInstructions: true,
          stops: { orderBy: { sequence: "asc" } },
        },
      },
      trackingEvents: { orderBy: { occurredAt: "asc" } },
      company: { select: { name: true, phone: true, email: true } },
      driver: {
        select: { firstName: true, lastName: true, phone: true },
      },
    },
  });
}

export async function getCompanyDeliveries(
  companyId: string,
  options?: { unassignedOnly?: boolean }
) {
  const deliveries = await prisma.delivery.findMany({
    where: {
      companyId,
      status: options?.unassignedOnly
        ? "PENDING"
        : { in: LIVE_DELIVERY_STATUSES },
    },
    include: {
      order: {
        select: {
          id: true,
          reference: true,
          itemCount: true,
          totalAmount: true,
          customerEmail: true,
          deliveryCategory: true,
          pickupAddress: true,
          pickupCity: true,
          pickupPostalCode: true,
          shippingAddress: true,
          shippingCity: true,
          shippingPostalCode: true,
          deliveryInstructions: true,
          customer: { select: { firstName: true, lastName: true, email: true } },
          items: { select: { name: true, quantity: true } },
        },
      },
      driver: { select: { id: true, firstName: true, lastName: true } },
    },
    orderBy: { createdAt: "desc" },
    take: COMPANY_DELIVERIES_TAKE,
  });

  const orders = await resolveCustomersByEmail(
    deliveries.map((delivery) => delivery.order)
  );
  const orderById = new Map(orders.map((order) => [order.id, order]));

  return deliveries.map((delivery) => ({
    ...delivery,
    order: orderById.get(delivery.order.id) ?? delivery.order,
  }));
}

export async function getCompanyDeliveryById(companyId: string, deliveryId: string) {
  return prisma.delivery.findFirst({
    where: { id: deliveryId, companyId },
    include: {
      order: {
        select: {
          id: true,
          reference: true,
          status: true,
          totalAmount: true,
          deliveryCategory: true,
          pickupAddress: true,
          pickupCity: true,
          pickupPostalCode: true,
          shippingAddress: true,
          shippingCity: true,
          shippingPostalCode: true,
          deliveryInstructions: true,
          customerEmail: true,
          customer: { select: { id: true, firstName: true, lastName: true, email: true, phone: true } },
          items: {
            select: {
              id: true,
              name: true,
              quantity: true,
              unitPrice: true,
              orderStopId: true,
            },
          },
          stops: { orderBy: { sequence: "asc" }, include: { items: true } },
        },
      },
      driver: { select: { id: true, firstName: true, lastName: true, phone: true, email: true } },
      customer: { select: { id: true, firstName: true, lastName: true, email: true, phone: true } },
      trackingEvents: { orderBy: { occurredAt: "asc" } },
    },
  });
}

export async function assignDeliveryToDriver(
  companyId: string,
  deliveryId: string,
  driverId: string,
  options?: {
    automatic?: boolean;
    reason?: string;
    force?: boolean;
    /** Verrou optimiste : n'assigne que si la livraison est encore non assignée (PENDING). */
    expectUnassigned?: boolean;
  }
) {
  const delivery = await prisma.delivery.findFirst({
    where: { id: deliveryId, companyId },
    include: { order: true },
  });
  if (!delivery) return null;
  if (delivery.status === "CANCELLED") throw new Error("DELIVERY_CANCELLED");

  const driver = await prisma.user.findFirst({
    where: {
      id: driverId,
      companyId,
      status: "ACTIVE",
      role: { systemRole: "DRIVER" },
    },
  });
  if (!driver) throw new Error("DRIVER_NOT_FOUND");

  if (!options?.automatic && !options?.force) {
    const [settings, drivers, tariffSettings] = await Promise.all([
      getCompanyDispatchSettings(companyId),
      getCompanyDriversWithActivity(companyId),
      getCompanyTariffSettings(companyId),
    ]);
    const driverActivity = drivers.find((item) => item.id === driverId);
    if (driverActivity) {
      const reasons = getDriverEligibilityReasons(
        driverActivity,
        {
          deliveryCategory: delivery.deliveryCategory,
          postalCode: delivery.postalCode,
          pickupPostalCode: delivery.pickupPostalCode,
        },
        settings,
        tariffSettings.tariffZones
      );
      if (reasons.length > 0) {
        if (isOnlySoftIneligibility(reasons)) {
          throw new Error(`DRIVER_OVER_CAPACITY:${formatEligibilityReasons(reasons)}`);
        }
        throw new Error(`DRIVER_INELIGIBLE:${formatEligibilityReasons(reasons)}`);
      }
    }
  }

  const driverName = `${driver.firstName} ${driver.lastName}`;

  return prisma.$transaction(async (tx) => {
    const nextStatus =
      delivery.status === "PENDING" ? "ASSIGNED" : delivery.status;

    if (options?.expectUnassigned) {
      // Update conditionnel atomique : échoue si un autre process a déjà pris la livraison.
      const lock = await tx.delivery.updateMany({
        where: { id: deliveryId, driverId: null, status: "PENDING" },
        data: {
          driverId: driver.id,
          driverName,
          status: "ASSIGNED",
          estimatedArrival: delivery.scheduledAt,
        },
      });
      if (lock.count === 0) {
        throw new Error("DELIVERY_ALREADY_ASSIGNED");
      }
    } else {
      await tx.delivery.update({
        where: { id: deliveryId },
        data: {
          driverId: driver.id,
          driverName,
          status: nextStatus,
          estimatedArrival: delivery.scheduledAt,
        },
      });
    }

    const updated = await tx.delivery.findUnique({
      where: { id: deliveryId },
      include: {
        order: {
          select: {
            reference: true,
            customerEmail: true,
            customer: { select: { firstName: true, lastName: true } },
          },
        },
        driver: { select: { id: true, firstName: true, lastName: true } },
      },
    });

    if (delivery.order.status !== "CANCELLED") {
      await tx.order.update({
        where: { id: delivery.orderId },
        data: { status: nextStatus as OrderStatus },
      });
    }

    const trackingLabel = options?.automatic
      ? "Assignée automatiquement"
      : options?.force
        ? "Assignation forcée"
        : delivery.driverId
          ? "Chauffeur réassigné"
          : "Assignée au chauffeur";

    const driverLabel = formatDriverDisplayName(driverName);

    const trackingDescription = options?.automatic
      ? [options.reason, driverLabel].filter(Boolean).join(" — ")
      : options?.reason
        ? `${options.reason} — ${driverLabel}`
        : `Livraison confiée à ${driverLabel}`;

    await tx.trackingEvent.create({
      data: {
        deliveryId,
        label: trackingLabel,
        description: trackingDescription,
      },
    });

    return updated;
  });
}

export async function getAvailableDeliveriesForDriver(companyId: string) {
  const settings = await getCompanyDispatchSettings(companyId);
  if (!settings.allowDriverSelfClaim) return [];

  return prisma.delivery.findMany({
    where: {
      companyId,
      status: "PENDING",
      driverId: null,
    },
    include: {
      order: {
        select: {
          reference: true,
          itemCount: true,
          notes: true,
          deliveryInstructions: true,
          customerEmail: true,
          customer: { select: { firstName: true, lastName: true, phone: true } },
          items: {
            select: {
              id: true,
              name: true,
              quantity: true,
              unitPrice: true,
              orderStopId: true,
            },
          },
          stops: { orderBy: { sequence: "asc" }, include: { items: true } },
        },
      },
    },
    orderBy: [{ scheduledAt: "asc" }, { createdAt: "asc" }],
    take: DRIVER_AVAILABLE_TAKE,
  });
}

export async function claimDeliveryByDriver(
  companyId: string,
  driverId: string,
  deliveryId: string
) {
  const settings = await getCompanyDispatchSettings(companyId);
  if (!settings.allowDriverSelfClaim) {
    throw new Error("DISPATCH_ONLY");
  }

  const delivery = await prisma.delivery.findFirst({
    where: {
      id: deliveryId,
      companyId,
      status: "PENDING",
      driverId: null,
    },
  });
  if (!delivery) throw new Error("DELIVERY_NOT_AVAILABLE");

  return assignDeliveryToDriver(companyId, deliveryId, driverId, {
    reason: "Prise en charge par le chauffeur",
    expectUnassigned: true,
  });
}

const DRIVER_MISSION_ORDER_INCLUDE = {
  order: {
    select: {
      reference: true,
      itemCount: true,
      notes: true,
      deliveryInstructions: true,
      customerEmail: true,
      customer: { select: { firstName: true, lastName: true, phone: true } },
      items: {
        select: {
          id: true,
          name: true,
          quantity: true,
          unitPrice: true,
          orderStopId: true,
        },
      },
      stops: { orderBy: { sequence: "asc" as const }, include: { items: true } },
    },
  },
};

export async function getDriverMissions(driverId: string) {
  const [active, delivered] = await Promise.all([
    prisma.delivery.findMany({
      where: {
        driverId,
        status: { in: ["ASSIGNED", "PURCHASING", "IN_DELIVERY"] },
      },
      include: DRIVER_MISSION_ORDER_INCLUDE,
      orderBy: [{ scheduledAt: "asc" }, { createdAt: "asc" }],
      take: DRIVER_ACTIVE_MISSIONS_TAKE,
    }),
    prisma.delivery.findMany({
      where: { driverId, status: "DELIVERED" },
      include: DRIVER_MISSION_ORDER_INCLUDE,
      orderBy: { completedAt: "desc" },
      take: DRIVER_DELIVERED_MISSIONS_TAKE,
    }),
  ]);

  return [...active, ...delivered];
}

export async function getDriverMissionById(driverId: string, deliveryId: string) {
  return prisma.delivery.findFirst({
    where: { id: deliveryId, driverId },
    include: {
      order: {
        select: {
          reference: true,
          itemCount: true,
          notes: true,
          deliveryInstructions: true,
          customerEmail: true,
          customer: { select: { firstName: true, lastName: true, phone: true } },
          items: {
            select: {
              id: true,
              name: true,
              quantity: true,
              unitPrice: true,
              orderStopId: true,
            },
          },
          stops: { orderBy: { sequence: "asc" }, include: { items: true } },
        },
      },
      trackingEvents: { orderBy: { occurredAt: "asc" } },
    },
  });
}

async function applyDriverPurchasePrices(
  tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
  orderId: string,
  purchaseItems: { id: string; unitPrice: number }[]
) {
  const orderItems = await tx.orderItem.findMany({ where: { orderId } });
  const orderItemIds = new Set(orderItems.map((item) => item.id));

  for (const item of purchaseItems) {
    if (!orderItemIds.has(item.id)) throw new Error("INVALID_PURCHASE_ITEMS");
    await tx.orderItem.update({
      where: { id: item.id },
      data: { unitPrice: item.unitPrice },
    });
  }

  const updatedItems = await tx.orderItem.findMany({ where: { orderId } });
  const totalAmount = updatedItems.reduce(
    (sum, item) => sum + Number(item.unitPrice) * item.quantity,
    0
  );

  await tx.order.update({
    where: { id: orderId },
    data: { totalAmount },
  });
}

/** Transitions de statut autorisées pour le chauffeur (empêche de sauter une étape). */
function isValidDriverStatusTransition(
  current: DeliveryStatus,
  next: DeliveryStatus,
  category: DeliveryCategory
): boolean {
  const flows: Record<"STANDARD" | "COURIER", Partial<Record<DeliveryStatus, DeliveryStatus[]>>> = {
    STANDARD: {
      ASSIGNED: ["PURCHASING", "IN_DELIVERY"],
      PURCHASING: ["IN_DELIVERY"],
      IN_DELIVERY: ["DELIVERED"],
    },
    // Coursier : la collecte (PURCHASING) est obligatoire avant la livraison.
    COURIER: {
      ASSIGNED: ["PURCHASING"],
      PURCHASING: ["IN_DELIVERY"],
      IN_DELIVERY: ["DELIVERED"],
    },
  };
  const key = category === "COURIER" ? "COURIER" : "STANDARD";
  return flows[key][current]?.includes(next) ?? false;
}

export async function updateDeliveryStatusByDriver(
  driverId: string,
  deliveryId: string,
  status: "PURCHASING" | "IN_DELIVERY" | "DELIVERED",
  options?: {
    purchaseItems?: { id: string; unitPrice: number }[];
    confirmOutOfRange?: boolean;
    latitude?: number;
    longitude?: number;
  }
) {
  const delivery = await prisma.delivery.findFirst({
    where: { id: deliveryId, driverId },
  });
  if (!delivery) return null;

  if (delivery.status === "ASSIGNED" && !delivery.missionStartedAt) {
    throw new Error("MISSION_NOT_STARTED");
  }
  if (
    !isValidDriverStatusTransition(
      delivery.status,
      status as DeliveryStatus,
      delivery.deliveryCategory
    )
  ) {
    throw new Error("INVALID_STATUS_TRANSITION");
  }

  const proximityRule = statusNeedsProximityCheck(status, delivery.deliveryCategory);
  if (proximityRule.required) {
    const overridePosition =
      options?.latitude != null && options?.longitude != null
        ? { latitude: options.latitude, longitude: options.longitude }
        : null;

    await assertDriverMissionProximityOrThrow(
      driverId,
      deliveryId,
      proximityRule.kind,
      options?.confirmOutOfRange,
      overridePosition
    );
  }

  const purchaseItems = options?.purchaseItems;
  const orderStatus = status as OrderStatus;
  const deliveryStatus = status as DeliveryStatus;

  // Position à horodater sur l'événement de suivi : celle fournie, sinon la dernière connue du chauffeur.
  let eventLatitude = options?.latitude ?? null;
  let eventLongitude = options?.longitude ?? null;
  if (eventLatitude == null || eventLongitude == null) {
    const lastLocation = await prisma.driverLocation.findUnique({
      where: { driverId },
      select: { latitude: true, longitude: true },
    });
    if (lastLocation) {
      eventLatitude = lastLocation.latitude;
      eventLongitude = lastLocation.longitude;
    }
  }

  return prisma.$transaction(async (tx) => {
    if (purchaseItems?.length) {
      await applyDriverPurchasePrices(tx, delivery.orderId, purchaseItems);
    }

    const updated = await tx.delivery.update({
      where: { id: deliveryId },
      data: {
        status: deliveryStatus,
        completedAt: status === "DELIVERED" ? new Date() : undefined,
      },
      include: {
        order: {
          select: {
            reference: true,
            itemCount: true,
            customerEmail: true,
            customer: { select: { firstName: true, lastName: true, phone: true } },
            items: { select: { id: true, name: true, quantity: true, unitPrice: true } },
          },
        },
      },
    });

    await tx.order.update({
      where: { id: delivery.orderId },
      data: { status: orderStatus },
    });

    await tx.trackingEvent.create({
      data: {
        deliveryId,
        label: getFulfillmentStatusLabel(orderStatus, delivery.deliveryCategory),
        description: "Statut mis à jour par le chauffeur",
        latitude: eventLatitude,
        longitude: eventLongitude,
      },
    });

    return updated;
  });
}

export async function adminUpdateDelivery(
  companyId: string,
  deliveryId: string,
  input: AdminUpdateDeliveryInput
) {
  const delivery = await prisma.delivery.findFirst({
    where: { id: deliveryId, companyId },
    include: { order: true },
  });
  if (!delivery) return null;

  return prisma.$transaction(async (tx) => {
    const deliveryData: Record<string, unknown> = {};
    const orderData: Record<string, unknown> = {};

    if (input.address) deliveryData.address = input.address;
    if (input.city) deliveryData.city = input.city;
    if (input.postalCode) deliveryData.postalCode = input.postalCode;
    if (input.pickupAddress !== undefined) {
      deliveryData.pickupAddress = input.pickupAddress;
      orderData.pickupAddress = input.pickupAddress;
    }
    if (input.pickupCity !== undefined) {
      deliveryData.pickupCity = input.pickupCity;
      orderData.pickupCity = input.pickupCity;
    }
    if (input.pickupPostalCode !== undefined) {
      deliveryData.pickupPostalCode = input.pickupPostalCode;
      orderData.pickupPostalCode = input.pickupPostalCode;
    }
    if (input.scheduledAt !== undefined) {
      deliveryData.scheduledAt = input.scheduledAt ? new Date(input.scheduledAt) : null;
      orderData.requestedDeliveryDate = input.scheduledAt
        ? new Date(input.scheduledAt)
        : null;
    }
    if (input.estimatedArrival !== undefined) {
      deliveryData.estimatedArrival = input.estimatedArrival
        ? new Date(input.estimatedArrival)
        : null;
    }
    if (input.unassignDriver) {
      deliveryData.driverId = null;
      deliveryData.driverName = null;
      if (delivery.status !== "CANCELLED" && delivery.status !== "DELIVERED") {
        deliveryData.status = "PENDING";
        orderData.status = "PENDING";
      }
    }
    if (input.status) {
      deliveryData.status = input.status;
      orderData.status = input.status;
      if (input.status === "DELIVERED") {
        deliveryData.completedAt = delivery.completedAt ?? new Date();
      }
      if (input.status === "CANCELLED") {
        deliveryData.driverId = null;
        deliveryData.driverName = null;
      }
    }

    if (input.address) orderData.shippingAddress = input.address;
    if (input.city) orderData.shippingCity = input.city;
    if (input.postalCode) orderData.shippingPostalCode = input.postalCode;

    const addressChanged = Boolean(
      input.address ||
        input.city ||
        input.postalCode ||
        input.pickupAddress !== undefined ||
        input.pickupCity !== undefined ||
        input.pickupPostalCode !== undefined
    );

    if (addressChanged) {
      const coords = await resolveDeliveryCoordinateFields({
        address: (deliveryData.address as string | undefined) ?? delivery.address,
        city: (deliveryData.city as string | null | undefined) ?? delivery.city,
        postalCode:
          (deliveryData.postalCode as string | null | undefined) ?? delivery.postalCode,
        pickupAddress:
          (deliveryData.pickupAddress as string | null | undefined) ??
          delivery.pickupAddress,
        pickupCity:
          (deliveryData.pickupCity as string | null | undefined) ?? delivery.pickupCity,
        pickupPostalCode:
          (deliveryData.pickupPostalCode as string | null | undefined) ??
          delivery.pickupPostalCode,
        includePickup: Boolean(
          (
            (deliveryData.pickupAddress as string | null | undefined) ??
            delivery.pickupAddress
          )?.trim()
        ),
      });
      deliveryData.latitude = coords.latitude;
      deliveryData.longitude = coords.longitude;
      deliveryData.pickupLatitude = coords.pickupLatitude;
      deliveryData.pickupLongitude = coords.pickupLongitude;
    }

    const updated = await tx.delivery.update({
      where: { id: deliveryId },
      data: deliveryData,
      include: {
        order: {
          select: {
            id: true,
            reference: true,
            status: true,
            customerEmail: true,
            customer: { select: { firstName: true, lastName: true, email: true, phone: true } },
            items: { select: { id: true, name: true, quantity: true, unitPrice: true } },
          },
        },
        driver: { select: { id: true, firstName: true, lastName: true, phone: true } },
        trackingEvents: { orderBy: { occurredAt: "asc" } },
      },
    });

    if (Object.keys(orderData).length > 0) {
      await tx.order.update({ where: { id: delivery.orderId }, data: orderData });
    }

    const events: { label: string; description?: string }[] = [];

    if (input.status) {
      events.push({
        label: getFulfillmentStatusLabel(input.status, delivery.deliveryCategory),
        description: input.reason
          ? `Statut modifié par l'administrateur — ${input.reason}`
          : "Statut modifié par l'administrateur",
      });
      if (input.status === "INVOICED") {
        await tx.invoice.updateMany({
          where: { orderId: delivery.orderId },
          data: { status: "PENDING" },
        });
      }
      if (input.status === "PAID") {
        await tx.invoice.updateMany({
          where: { orderId: delivery.orderId },
          data: { status: "PAID", paidAt: new Date() },
        });
      }
    } else if (
      input.address ||
      input.city ||
      input.postalCode ||
      input.pickupAddress ||
      input.scheduledAt !== undefined
    ) {
      events.push({
        label: "Livraison modifiée",
        description: input.reason ?? "Informations mises à jour par l'administrateur",
      });
    }

    if (input.unassignDriver) {
      events.push({
        label: "Chauffeur retiré",
        description: input.reason ?? "Réassignation par l'administrateur",
      });
    }

    for (const event of events) {
      await tx.trackingEvent.create({
        data: { deliveryId, label: event.label, description: event.description },
      });
    }

    return updated;
  });
}

function emptyDriverStats() {
  return {
    assigned: 0,
    inTransit: 0,
    deliveredToday: 0,
    activityToday: 0,
    activeByCategory: { STANDARD: 0, COURIER: 0, SPECIAL_MISSION: 0 },
  };
}

export async function getCompanyDriversWithActivity(companyId: string) {
  const today = startOfToday();

  const drivers = await prisma.user.findMany({
    where: { companyId, status: "ACTIVE", role: { systemRole: "DRIVER" } },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      phone: true,
      lastLoginAt: true,
    },
    orderBy: { firstName: "asc" },
  });

  if (drivers.length === 0) return [];

  const driverIds = drivers.map((driver) => driver.id);
  const statsMap = new Map(driverIds.map((id) => [id, emptyDriverStats()]));

  const [activeGroups, deliveredTodayGroups, activityRows] = await Promise.all([
    prisma.delivery.groupBy({
      by: ["driverId", "status", "deliveryCategory"],
      where: {
        companyId,
        driverId: { in: driverIds },
        status: { in: ["ASSIGNED", "PURCHASING", "IN_DELIVERY"] },
      },
      _count: { _all: true },
    }),
    prisma.delivery.groupBy({
      by: ["driverId"],
      where: {
        companyId,
        driverId: { in: driverIds },
        status: "DELIVERED",
        completedAt: { gte: today },
      },
      _count: { _all: true },
    }),
    prisma.delivery.findMany({
      where: {
        companyId,
        driverId: { in: driverIds },
        trackingEvents: { some: { occurredAt: { gte: today } } },
      },
      select: {
        driverId: true,
        _count: {
          select: { trackingEvents: { where: { occurredAt: { gte: today } } } },
        },
      },
    }),
  ]);

  for (const row of activeGroups) {
    if (!row.driverId) continue;
    const stats = statsMap.get(row.driverId);
    if (!stats) continue;
    const n = row._count._all;
    if (row.status === "ASSIGNED") stats.assigned += n;
    if (row.status === "PURCHASING" || row.status === "IN_DELIVERY") {
      stats.inTransit += n;
    }
    stats.activeByCategory[row.deliveryCategory] += n;
  }

  for (const row of deliveredTodayGroups) {
    if (!row.driverId) continue;
    const stats = statsMap.get(row.driverId);
    if (!stats) continue;
    stats.deliveredToday += row._count._all;
  }

  for (const row of activityRows) {
    if (!row.driverId) continue;
    const stats = statsMap.get(row.driverId);
    if (!stats) continue;
    stats.activityToday += row._count.trackingEvents;
  }

  return drivers.map((driver) => ({
    ...driver,
    ...statsMap.get(driver.id)!,
  }));
}

export type DriverDispatchWorkload = {
  id: string;
  firstName: string;
  lastName: string;
  assigned: number;
  inTransit: number;
  today: CategoryCounts;
  next7Days: CategoryCounts;
};

export async function getDriverDispatchWorkload(
  companyId: string
): Promise<DriverDispatchWorkload[]> {
  const todayStart = startOfToday();
  const tomorrowStart = addDays(todayStart, 1);
  const weekEnd = addDays(todayStart, 7);

  const drivers = await prisma.user.findMany({
    where: { companyId, status: "ACTIVE", role: { systemRole: "DRIVER" } },
    select: { id: true, firstName: true, lastName: true },
    orderBy: { firstName: "asc" },
  });

  if (drivers.length === 0) return [];

  const driverIds = drivers.map((d) => d.id);
  const workloadMap = new Map(
    driverIds.map((id) => [
      id,
      {
        today: emptyCategoryCounts(),
        next7Days: emptyCategoryCounts(),
        assigned: 0,
        inTransit: 0,
      },
    ])
  );

  const plannedWindow = (from: Date, to: Date) => ({
    companyId,
    driverId: { in: driverIds },
    status: { not: "CANCELLED" as const },
    OR: [
      { scheduledAt: { gte: from, lt: to } },
      { scheduledAt: null, createdAt: { gte: from, lt: to } },
    ],
  });

  const [activeGroups, todayGroups, weekGroups] = await Promise.all([
    prisma.delivery.groupBy({
      by: ["driverId", "status"],
      where: {
        companyId,
        driverId: { in: driverIds },
        status: { in: ["ASSIGNED", "PURCHASING", "IN_DELIVERY"] },
      },
      _count: { _all: true },
    }),
    prisma.delivery.groupBy({
      by: ["driverId", "deliveryCategory"],
      where: plannedWindow(todayStart, tomorrowStart),
      _count: { _all: true },
    }),
    prisma.delivery.groupBy({
      by: ["driverId", "deliveryCategory"],
      where: plannedWindow(todayStart, weekEnd),
      _count: { _all: true },
    }),
  ]);

  for (const row of activeGroups) {
    if (!row.driverId) continue;
    const bucket = workloadMap.get(row.driverId);
    if (!bucket) continue;
    if (row.status === "ASSIGNED") bucket.assigned += row._count._all;
    if (row.status === "PURCHASING" || row.status === "IN_DELIVERY") {
      bucket.inTransit += row._count._all;
    }
  }

  for (const row of todayGroups) {
    if (!row.driverId) continue;
    const bucket = workloadMap.get(row.driverId);
    if (!bucket) continue;
    bumpCategory(bucket.today, row.deliveryCategory, row._count._all);
  }

  for (const row of weekGroups) {
    if (!row.driverId) continue;
    const bucket = workloadMap.get(row.driverId);
    if (!bucket) continue;
    bumpCategory(bucket.next7Days, row.deliveryCategory, row._count._all);
  }

  return drivers.map((driver) => {
    const w = workloadMap.get(driver.id)!;
    return {
      id: driver.id,
      firstName: driver.firstName,
      lastName: driver.lastName,
      assigned: w.assigned,
      inTransit: w.inTransit,
      today: w.today,
      next7Days: w.next7Days,
    };
  });
}

export async function getCompanyDriverDetail(companyId: string, driverId: string) {
  const today = startOfToday();

  const driver = await prisma.user.findFirst({
    where: { id: driverId, companyId, role: { systemRole: "DRIVER" } },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      phone: true,
      lastLoginAt: true,
      createdAt: true,
      status: true,
    },
  });
  if (!driver) return null;

  const [stats, missions, todayEvents] = await Promise.all([
    getDriverStats(driverId),
    prisma.delivery.findMany({
      where: { driverId, companyId },
      include: {
        order: {
          select: {
            reference: true,
            customerEmail: true,
            customer: { select: { firstName: true, lastName: true } },
          },
        },
        trackingEvents: { orderBy: { occurredAt: "desc" }, take: 5 },
      },
      orderBy: { updatedAt: "desc" },
      take: 30,
    }),
    prisma.trackingEvent.findMany({
      where: {
        occurredAt: { gte: today },
        delivery: { driverId, companyId },
      },
      include: {
        delivery: { select: { reference: true, status: true } },
      },
      orderBy: { occurredAt: "desc" },
      take: DRIVER_TODAY_EVENTS_TAKE,
    }),
  ]);

  return { driver, stats, missions, todayEvents };
}

export async function getDriverStats(driverId: string) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [assigned, inTransit, deliveredToday] = await Promise.all([
    prisma.delivery.count({ where: { driverId, status: "ASSIGNED" } }),
    prisma.delivery.count({
      where: { driverId, status: { in: ["PURCHASING", "IN_DELIVERY"] } },
    }),
    prisma.delivery.count({
      where: {
        driverId,
        status: "DELIVERED",
        completedAt: { gte: today },
      },
    }),
  ]);

  return { assigned, inTransit, deliveredToday };
}

export const DELIVERY_STATUS_LABELS: Record<DeliveryStatus, string> = FULFILLMENT_STATUS_LABELS;
