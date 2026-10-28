import { prisma } from "@/services/prisma/client";
import type { DeliveryCategory, DeliveryStatus, OrderStatus, Prisma } from "@prisma/client";
import type { AdminUpdateDeliveryInput } from "@/lib/validations/delivery";
import { getCompanyDispatchSettings, parseDispatchSettings } from "@/domains/company/dispatch-settings.service";
import { parseTariffSettings } from "@/domains/company/tariff-settings.service";
import {
  formatEligibilityReasons,
  getDriverEligibilityReasons,
  splitEligibilityReasons,
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
import { queueDeliveryStatusNotification } from "@/domains/client-portal/notify.service";
import { kickOperationJob } from "@/domains/operations/operation-job.service";
import { queueDeliveryInvoiceJob } from "@/domains/invoice/delivery-invoice.service";
import { POD_FAILURE_LABELS, type PodFailureCode, type PodOutcome } from "@/lib/pod/codes";
import { resolveDeliveryCoordinateFields } from "@/domains/delivery/delivery-coordinates";
import {
  getAssignmentBlockReason,
  getCancellationBlockReason,
  getUnassignmentBlockReason,
} from "@/domains/delivery/dispatch-policy";
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
  companyId: string,
  options?: { take?: number }
) {
  return prisma.delivery.findMany({
    where: { customerId, companyId },
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
export async function repairCourierDeliveryIfNeeded(
  deliveryId: string,
  customerId?: string,
  companyId?: string
) {
  const delivery = await prisma.delivery.findFirst({
    where: {
      id: deliveryId,
      ...(customerId ? { customerId } : {}),
      ...(companyId ? { companyId } : {}),
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

export async function getClientDeliveryById(
  customerId: string,
  companyId: string,
  deliveryId: string
) {
  await repairCourierDeliveryIfNeeded(deliveryId, customerId, companyId);

  return prisma.delivery.findFirst({
    where: { id: deliveryId, customerId, companyId },
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
          requestedDeliveryDate: true,
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

const COMPANY_DELIVERY_INCLUDE = {
  order: {
    select: {
      id: true,
      reference: true,
      itemCount: true,
      totalAmount: true,
      requestedDeliveryDate: true,
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
} as const;

export async function getCompanyDeliveries(
  companyId: string,
  options?: { unassignedOnly?: boolean; includeDeliveryId?: string }
) {
  const status = options?.unassignedOnly
    ? ("PENDING" as const)
    : { in: LIVE_DELIVERY_STATUSES };
  const [listedDeliveries, targetedDelivery] = await Promise.all([
    prisma.delivery.findMany({
    where: {
      companyId,
      status,
    },
    include: COMPANY_DELIVERY_INCLUDE,
    orderBy: { createdAt: "desc" },
    take: COMPANY_DELIVERIES_TAKE,
    }),
    options?.includeDeliveryId
      ? prisma.delivery.findFirst({
          where: { id: options.includeDeliveryId, companyId, status },
          include: COMPANY_DELIVERY_INCLUDE,
        })
      : Promise.resolve(null),
  ]);

  const deliveries =
    targetedDelivery && !listedDeliveries.some((delivery) => delivery.id === targetedDelivery.id)
      ? [targetedDelivery, ...listedDeliveries]
      : listedDeliveries;

  const orders = await resolveCustomersByEmail(
    deliveries.map((delivery) => delivery.order),
    companyId
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
          requestedDeliveryDate: true,
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

async function getDriverActivityForAssignment(
  tx: Prisma.TransactionClient,
  companyId: string,
  driverId: string,
  excludeDeliveryId: string
) {
  const groups = await tx.delivery.groupBy({
    by: ["status", "deliveryCategory"],
    where: {
      companyId,
      driverId,
      id: { not: excludeDeliveryId },
      status: { in: ["ASSIGNED", "PURCHASING", "IN_DELIVERY"] },
    },
    _count: { _all: true },
  });

  const activity = {
    id: driverId,
    assigned: 0,
    inTransit: 0,
    activeByCategory: {
      STANDARD: 0,
      COURIER: 0,
      SPECIAL_MISSION: 0,
    },
  };
  for (const row of groups) {
    const count = row._count._all;
    if (row.status === "ASSIGNED") activity.assigned += count;
    else activity.inTransit += count;
    activity.activeByCategory[row.deliveryCategory] += count;
  }
  return activity;
}

const ASSIGNMENT_DELIVERY_INCLUDE = {
  order: {
    select: {
      reference: true,
      customerEmail: true,
      customer: { select: { firstName: true, lastName: true } },
    },
  },
  driver: { select: { id: true, firstName: true, lastName: true } },
} as const;

export async function assignDeliveryToDriver(
  companyId: string,
  deliveryId: string,
  driverId: string,
  options?: {
    automatic?: boolean;
    reason?: string;
    /** Dépasse uniquement les plafonds de charge, jamais les règles dures ni l'état métier. */
    force?: boolean;
    /** Le libre choix ne peut jamais remplacer une affectation existante. */
    expectUnassigned?: boolean;
  }
) {
  const { updated, notificationJobId } = await prisma.$transaction(async (tx) => {
    await tx.$queryRaw<Array<{ id: string }>>`
      SELECT id FROM "companies" WHERE id = ${companyId} FOR SHARE
    `;
    await tx.$queryRaw<Array<{ id: string }>>`
      SELECT id FROM "users" WHERE id = ${driverId} FOR UPDATE
    `;

    const [company, driver, current] = await Promise.all([
      tx.company.findUnique({ where: { id: companyId }, select: { settings: true } }),
      tx.user.findFirst({
        where: {
          id: driverId,
          companyId,
          status: "ACTIVE",
          role: { systemRole: "DRIVER" },
        },
      }),
      tx.delivery.findFirst({
        where: { id: deliveryId, companyId },
        include: { order: true },
      }),
    ]);

    if (!current) return { updated: null, notificationJobId: null };
    if (options?.expectUnassigned && (current.driverId !== null || current.status !== "PENDING")) {
      throw new Error("DELIVERY_NOT_AVAILABLE");
    }
    if (!driver) throw new Error("DRIVER_NOT_FOUND");
    if (!company) throw new Error("COMPANY_NOT_FOUND");

    const assignmentBlock = getAssignmentBlockReason(current);
    if (assignmentBlock) throw new Error(assignmentBlock);
    if (["CANCELLED", "DELIVERED", "FAILED", "INVOICED", "PAID"].includes(current.order.status)) {
      throw new Error("DELIVERY_NOT_ASSIGNABLE");
    }

    if (current.driverId === driver.id) {
      const idempotent = await tx.delivery.findUnique({
        where: { id: deliveryId },
        include: ASSIGNMENT_DELIVERY_INCLUDE,
      });
      return { updated: idempotent, notificationJobId: null };
    }

    const rawSettings = (company.settings ?? {}) as Record<string, unknown>;
    const settings = parseDispatchSettings(rawSettings.dispatchRules);
    const tariffSettings = parseTariffSettings(rawSettings);
    const activity = await getDriverActivityForAssignment(
      tx,
      companyId,
      driver.id,
      deliveryId
    );
    const reasons = getDriverEligibilityReasons(
      activity,
      {
        deliveryCategory: current.deliveryCategory,
        postalCode: current.postalCode,
        pickupPostalCode: current.pickupPostalCode,
      },
      settings,
      tariffSettings.tariffZones
    );
    const { soft, hard } = splitEligibilityReasons(reasons);
    if (hard.length > 0) {
      throw new Error(`DRIVER_INELIGIBLE:${formatEligibilityReasons(hard)}`);
    }
    if (soft.length > 0 && !options?.force) {
      throw new Error(`DRIVER_OVER_CAPACITY:${formatEligibilityReasons(soft)}`);
    }

    const driverName = `${driver.firstName} ${driver.lastName}`;
    const claim = await tx.delivery.updateMany({
      where: {
        id: deliveryId,
        companyId,
        status: current.status,
        driverId: current.driverId,
        missionStartedAt: null,
        updatedAt: current.updatedAt,
      },
      data: {
        driverId: driver.id,
        driverName,
        status: "ASSIGNED",
        estimatedArrival: current.scheduledAt,
        missionAcceptedAt: null,
        updatedAt: new Date(Math.max(Date.now(), current.updatedAt.getTime() + 1)),
      },
    });

    if (claim.count === 0) {
      const latest = await tx.delivery.findFirst({
        where: { id: deliveryId, companyId },
        include: ASSIGNMENT_DELIVERY_INCLUDE,
      });
      if (latest?.driverId === driver.id && latest.status === "ASSIGNED") {
        return { updated: latest, notificationJobId: null };
      }
      if (latest) {
        const latestBlock = getAssignmentBlockReason(latest);
        if (latestBlock) throw new Error(latestBlock);
      }
      throw new Error("DELIVERY_ASSIGNMENT_CONFLICT");
    }

    const orderClaim = await tx.order.updateMany({
      where: {
        id: current.orderId,
        companyId,
        status: { notIn: ["CANCELLED", "DELIVERED", "FAILED", "INVOICED", "PAID"] },
      },
      data: { status: "ASSIGNED" },
    });
    if (orderClaim.count === 0) throw new Error("DELIVERY_NOT_ASSIGNABLE");

    const updated = await tx.delivery.findUnique({
      where: { id: deliveryId },
      include: ASSIGNMENT_DELIVERY_INCLUDE,
    });
    if (!updated) throw new Error("DELIVERY_ASSIGNMENT_CONFLICT");

    const trackingLabel = options?.automatic
      ? "Assignée automatiquement"
      : options?.force
        ? current.driverId
          ? "Réassignation forcée"
          : "Assignation forcée"
        : current.driverId
          ? "Chauffeur réassigné"
          : "Assignée au chauffeur";
    const newDriverLabel = formatDriverDisplayName(driverName);
    const transition = current.driverId
      ? `${formatDriverDisplayName(current.driverName)} → ${newDriverLabel}`
      : `Livraison confiée à ${newDriverLabel}`;
    const trackingDescription = [transition, options?.reason, current.missionAcceptedAt ? `Prise en charge précédente : ${current.missionAcceptedAt.toISOString()}` : null].filter(Boolean).join(" — ");

    const trackingEvent = await tx.trackingEvent.create({
      data: {
        deliveryId,
        label: trackingLabel,
        description: trackingDescription,
      },
    });

    const notificationJob = await queueDeliveryStatusNotification(tx, {
      customerId: current.customerId,
      companyId,
      status: updated.status,
      reference: updated.reference,
      deliveryId: updated.id,
      eventId: trackingEvent.id,
    });

    return { updated, notificationJobId: notificationJob?.id ?? null };
  }, { maxWait: 10_000, timeout: 30_000 });

  if (notificationJobId) kickOperationJob(notificationJobId);
  return updated;
}

export async function getAvailableDeliveriesForDriver(companyId: string, knownSettings?: ReturnType<typeof parseDispatchSettings>) {
  const settings = knownSettings ?? await getCompanyDispatchSettings(companyId);
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
    reason: "Libre affectation par le chauffeur — confirmation attendue",
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
      requestedDeliveryDate: true,
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
      where: { driverId, status: { in: ["DELIVERED", "FAILED"] } },
      include: DRIVER_MISSION_ORDER_INCLUDE,
      orderBy: { completedAt: "desc" },
      take: DRIVER_DELIVERED_MISSIONS_TAKE,
    }),
  ]);

  return [...active, ...delivered];
}

export async function getDriverMissionById(
  driverId: string,
  companyId: string,
  deliveryId: string
) {
  return prisma.delivery.findFirst({
    where: { id: deliveryId, driverId, companyId },
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
      IN_DELIVERY: ["DELIVERED", "FAILED"],
    },
    // Coursier : la collecte (PURCHASING) est obligatoire avant la livraison.
    COURIER: {
      ASSIGNED: ["PURCHASING"],
      PURCHASING: ["IN_DELIVERY"],
      IN_DELIVERY: ["DELIVERED", "FAILED"],
    },
  };
  const key = category === "COURIER" ? "COURIER" : "STANDARD";
  return flows[key][current]?.includes(next) ?? false;
}

export async function updateDeliveryStatusByDriver(
  driverId: string,
  deliveryId: string,
  status: "PURCHASING" | "IN_DELIVERY" | "DELIVERED" | "FAILED",
  options?: {
    purchaseItems?: { id: string; unitPrice: number }[];
    confirmOutOfRange?: boolean;
    latitude?: number;
    longitude?: number;
    podOutcome?: PodOutcome;
    podFailureCode?: PodFailureCode;
    podNote?: string;
    podPhotoPath?: string;
    podSignaturePath?: string;
    podRecipientName?: string | null;
    podSignatureRefusedReason?: string | null;
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

  if (status === "DELIVERED" && !options?.podPhotoPath) {
    throw new Error("POD_PHOTO_REQUIRED");
  }
  if (status === "FAILED" && !options?.podFailureCode) {
    throw new Error("POD_REASON_REQUIRED");
  }

  const proximityRule = statusNeedsProximityCheck(status, delivery.deliveryCategory);
  if (proximityRule.required) {
    const overridePosition =
      options?.latitude != null && options?.longitude != null
        ? { latitude: options.latitude, longitude: options.longitude }
        : null;

    await assertDriverMissionProximityOrThrow(
      driverId,
      delivery.companyId,
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
  let eventPositionAt: Date | null = eventLatitude != null && eventLongitude != null ? new Date() : null;
  if (eventLatitude == null || eventLongitude == null) {
    const lastLocation = await prisma.driverLocation.findUnique({
      where: { driverId },
      select: { latitude: true, longitude: true, updatedAt: true },
    });
    if (lastLocation) {
      eventLatitude = lastLocation.latitude;
      eventLongitude = lastLocation.longitude;
      eventPositionAt = lastLocation.updatedAt;
    }
  }

  const { updated, notificationJobId, invoiceJobId } = await prisma.$transaction(async (tx) => {
    const claim = await tx.delivery.updateMany({
      where: {
        id: deliveryId,
        companyId: delivery.companyId,
        driverId,
        status: delivery.status,
        missionStartedAt: delivery.missionStartedAt,
        updatedAt: delivery.updatedAt,
      },
      data: {
        status: deliveryStatus,
        completedAt: status === "DELIVERED" || status === "FAILED" ? new Date() : undefined,
        ...(status === "DELIVERED" || status === "FAILED"
          ? {
              podOutcome: (options?.podOutcome ??
                (status === "FAILED" ? "FAILED" : "SUCCESS")) as string,
              podPhotoPath: options?.podPhotoPath ?? null,
              podFailureCode: status === "FAILED" ? options?.podFailureCode ?? null : null,
              podNote: options?.podNote?.trim() || null,
              podCapturedAt: new Date(),
              podSignaturePath: status === "DELIVERED" ? options?.podSignaturePath ?? null : null,
              podRecipientName: status === "DELIVERED" ? options?.podRecipientName?.trim() || null : null,
              podSignatureRefusedReason:
                status === "DELIVERED" ? options?.podSignatureRefusedReason?.trim() || null : null,
              podLatitude: eventLatitude,
              podLongitude: eventLongitude,
              podPositionAt: eventLatitude != null ? eventPositionAt : null,
            }
          : {}),
      },
    });
    if (claim.count === 0) throw new Error("DELIVERY_STATUS_CONFLICT");

    if (purchaseItems?.length) {
      await applyDriverPurchasePrices(tx, delivery.orderId, purchaseItems);
    }

    const orderClaim = await tx.order.updateMany({
      where: {
        id: delivery.orderId,
        companyId: delivery.companyId,
        status: delivery.status as OrderStatus,
      },
      data: { status: orderStatus },
    });
    if (orderClaim.count === 0) throw new Error("ORDER_STATUS_CONFLICT");

    const updated = await tx.delivery.findUnique({
      where: { id: deliveryId },
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
    if (!updated) throw new Error("DELIVERY_STATUS_CONFLICT");

    const trackingEvent = await tx.trackingEvent.create({
      data: {
        deliveryId,
        label: getFulfillmentStatusLabel(orderStatus, delivery.deliveryCategory),
        description:
          status === "FAILED"
            ? [
                options?.podFailureCode
                  ? POD_FAILURE_LABELS[options.podFailureCode]
                  : "Échec de livraison",
                options?.podNote?.trim(),
              ]
                .filter(Boolean)
                .join(" — ")
            : "Statut mis à jour par le chauffeur",
        latitude: eventLatitude,
        longitude: eventLongitude,
      },
    });

    const notificationJob = await queueDeliveryStatusNotification(tx, {
      customerId: delivery.customerId,
      companyId: delivery.companyId,
      status: updated.status,
      reference: updated.reference,
      deliveryId: updated.id,
      eventId: trackingEvent.id,
    });
    // DEMO-3 : facture à la livraison inscrite en tâche durable (si l'entreprise l'a activée).
    const invoiceJob = status === "DELIVERED"
      ? await queueDeliveryInvoiceJob(tx, { companyId: delivery.companyId, orderId: delivery.orderId, passageKey: trackingEvent.id })
      : null;

    return { updated, notificationJobId: notificationJob?.id ?? null, invoiceJobId: invoiceJob?.id ?? null };
  }, { maxWait: 10_000, timeout: 30_000 });

  if (notificationJobId) kickOperationJob(notificationJobId);
  if (invoiceJobId) kickOperationJob(invoiceJobId);

  return updated;
}

const ADMIN_DELIVERY_INCLUDE = {
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
  trackingEvents: { orderBy: { occurredAt: "asc" as const } },
} as const;

async function unassignDeliveryBeforeStart(
  companyId: string,
  deliveryId: string,
  reason?: string
) {
  const result = await prisma.$transaction(async (tx) => {
    const current = await tx.delivery.findFirst({
      where: { id: deliveryId, companyId },
      include: { order: true },
    });
    if (!current) return { updated: null, notificationJobId: null };

    const block = getUnassignmentBlockReason(current);
    if (block) throw new Error(block);
    if (!current.driverId && current.status === "PENDING") {
      const updated = await tx.delivery.findUnique({
        where: { id: deliveryId },
        include: ADMIN_DELIVERY_INCLUDE,
      });
      return { updated, notificationJobId: null };
    }

    const claim = await tx.delivery.updateMany({
      where: {
        id: deliveryId,
        companyId,
        status: "ASSIGNED",
        driverId: current.driverId,
        missionStartedAt: null,
        updatedAt: current.updatedAt,
      },
      data: {
        driverId: null,
        driverName: null,
        missionAcceptedAt: null,
        updatedAt: new Date(Math.max(Date.now(), current.updatedAt.getTime() + 1)),
        status: "PENDING",
      },
    });
    if (claim.count === 0) throw new Error("DELIVERY_STATUS_CONFLICT");

    const orderClaim = await tx.order.updateMany({
      where: {
        id: current.orderId,
        companyId,
        status: { notIn: ["CANCELLED", "DELIVERED", "FAILED", "INVOICED", "PAID"] },
      },
      data: { status: "PENDING" },
    });
    if (orderClaim.count === 0) throw new Error("DELIVERY_NOT_ASSIGNABLE");

    const trackingEvent = await tx.trackingEvent.create({
      data: {
        deliveryId,
        label: "Chauffeur retiré",
        description: [
          `${formatDriverDisplayName(current.driverName)} retiré avant le démarrage`,
          reason?.trim(),
        ].filter(Boolean).join(" — "),
      },
    });
    const updated = await tx.delivery.findUnique({
      where: { id: deliveryId },
      include: ADMIN_DELIVERY_INCLUDE,
    });
    if (!updated) throw new Error("DELIVERY_STATUS_CONFLICT");
    const notificationJob = await queueDeliveryStatusNotification(tx, {
      customerId: current.customerId,
      companyId,
      status: "PENDING",
      reference: updated.reference,
      deliveryId,
      eventId: trackingEvent.id,
    });
    return { updated, notificationJobId: notificationJob?.id ?? null };
  }, { maxWait: 10_000, timeout: 30_000 });

  if (result.notificationJobId) kickOperationJob(result.notificationJobId);
  return result.updated;
}

async function cancelDeliveryByAdmin(
  companyId: string,
  deliveryId: string,
  reason?: string
) {
  const result = await prisma.$transaction(async (tx) => {
    const current = await tx.delivery.findFirst({
      where: { id: deliveryId, companyId },
      include: { order: true },
    });
    if (!current) return { updated: null, notificationJobId: null };

    const block = getCancellationBlockReason(current, reason);
    if (block) throw new Error(block);
    if (current.status === "CANCELLED") {
      const updated = await tx.delivery.findUnique({
        where: { id: deliveryId },
        include: ADMIN_DELIVERY_INCLUDE,
      });
      return { updated, notificationJobId: null };
    }

    const paidInvoices = await tx.invoice.count({
      where: { orderId: current.orderId, status: "PAID" },
    });
    if (paidInvoices > 0) throw new Error("DELIVERY_PAID");

    const claim = await tx.delivery.updateMany({
      where: {
        id: deliveryId,
        companyId,
        status: current.status,
        driverId: current.driverId,
        missionStartedAt: current.missionStartedAt,
        updatedAt: current.updatedAt,
      },
      data: {
        status: "CANCELLED",
        driverId: null,
        driverName: null,
      },
    });
    if (claim.count === 0) throw new Error("DELIVERY_STATUS_CONFLICT");

    const orderClaim = await tx.order.updateMany({
      where: { id: current.orderId, companyId, status: current.order.status },
      data: { status: "CANCELLED" },
    });
    if (orderClaim.count === 0) throw new Error("ORDER_STATUS_CONFLICT");
    await tx.invoice.updateMany({
      where: { orderId: current.orderId, status: { not: "PAID" } },
      data: { status: "CANCELLED" },
    });

    const trackingEvent = await tx.trackingEvent.create({
      data: {
        deliveryId,
        label: "Annulée",
        description: [
          current.missionStartedAt
            ? "Mission annulée après démarrage"
            : "Livraison annulée avant démarrage",
          current.driverId ? formatDriverDisplayName(current.driverName) : null,
          reason?.trim(),
        ].filter(Boolean).join(" — "),
      },
    });
    const updated = await tx.delivery.findUnique({
      where: { id: deliveryId },
      include: ADMIN_DELIVERY_INCLUDE,
    });
    if (!updated) throw new Error("DELIVERY_STATUS_CONFLICT");
    const notificationJob = await queueDeliveryStatusNotification(tx, {
      customerId: current.customerId,
      companyId,
      status: "CANCELLED",
      reference: updated.reference,
      deliveryId,
      eventId: trackingEvent.id,
    });
    return { updated, notificationJobId: notificationJob?.id ?? null };
  }, { maxWait: 10_000, timeout: 30_000 });

  if (result.notificationJobId) kickOperationJob(result.notificationJobId);
  return result.updated;
}

export async function adminUpdateDelivery(
  companyId: string,
  deliveryId: string,
  input: AdminUpdateDeliveryInput
) {
  if (input.status === "INVOICED" || input.status === "PAID") {
    throw new Error("BILLING_STATUS_NOT_LOGISTICS");
  }
  if (input.status === "ASSIGNED") {
    throw new Error("DELIVERY_ASSIGNMENT_REQUIRED");
  }
  if (input.unassignDriver) {
    const hasOtherMutation = Boolean(
      input.status ||
      input.address ||
      input.city ||
      input.postalCode ||
      input.pickupAddress !== undefined ||
      input.pickupCity !== undefined ||
      input.pickupPostalCode !== undefined ||
      input.scheduledAt !== undefined ||
      input.estimatedArrival !== undefined
    );
    if (hasOtherMutation) throw new Error("DELIVERY_UPDATE_CONFLICT");
    return unassignDeliveryBeforeStart(companyId, deliveryId, input.reason);
  }
  if (input.status === "CANCELLED") {
    const hasOtherMutation = Boolean(
      input.address ||
      input.city ||
      input.postalCode ||
      input.pickupAddress !== undefined ||
      input.pickupCity !== undefined ||
      input.pickupPostalCode !== undefined ||
      input.scheduledAt !== undefined ||
      input.estimatedArrival !== undefined
    );
    if (hasOtherMutation) throw new Error("DELIVERY_UPDATE_CONFLICT");
    return cancelDeliveryByAdmin(companyId, deliveryId, input.reason);
  }

  const delivery = await prisma.delivery.findFirst({
    where: { id: deliveryId, companyId },
    include: { order: true },
  });
  if (!delivery) return null;
  if (input.status === "PENDING" && delivery.driverId) {
    throw new Error("DELIVERY_UPDATE_CONFLICT");
  }
  if (
    (input.status === "PURCHASING" || input.status === "IN_DELIVERY") &&
    (!delivery.driverId || !delivery.missionStartedAt)
  ) {
    throw new Error("DELIVERY_MISSION_STARTED");
  }

  const { updated, notificationJobId, invoiceJobId } = await prisma.$transaction(async (tx) => {
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
    if (input.status) {
      deliveryData.status = input.status;
      orderData.status = input.status;
      if (input.status === "DELIVERED" || input.status === "FAILED") {
        deliveryData.completedAt = delivery.completedAt ?? new Date();
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

    const claim = await tx.delivery.updateMany({
      where: {
        id: deliveryId,
        companyId,
        status: delivery.status,
        driverId: delivery.driverId,
        missionStartedAt: delivery.missionStartedAt,
        updatedAt: delivery.updatedAt,
      },
      data: deliveryData,
    });
    if (claim.count === 0) throw new Error("DELIVERY_STATUS_CONFLICT");

    if (Object.keys(orderData).length > 0) {
      const orderClaim = await tx.order.updateMany({
        where: { id: delivery.orderId, companyId, status: delivery.order.status },
        data: orderData,
      });
      if (orderClaim.count === 0) throw new Error("ORDER_STATUS_CONFLICT");
    }

    const events: { label: string; description?: string }[] = [];
    if (input.status) {
      events.push({
        label: getFulfillmentStatusLabel(input.status, delivery.deliveryCategory),
        description: input.reason
          ? `Statut modifié par l'administrateur — ${input.reason}`
          : "Statut modifié par l'administrateur",
      });
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

    let statusEventId: string | null = null;
    for (const [index, event] of events.entries()) {
      const trackingEvent = await tx.trackingEvent.create({
        data: { deliveryId, label: event.label, description: event.description },
      });
      if (input.status && index === 0) statusEventId = trackingEvent.id;
    }

    const updated = await tx.delivery.findUnique({
      where: { id: deliveryId },
      include: ADMIN_DELIVERY_INCLUDE,
    });
    if (!updated) throw new Error("DELIVERY_STATUS_CONFLICT");
    const notificationJob = input.status && statusEventId
      ? await queueDeliveryStatusNotification(tx, {
          customerId: delivery.customerId,
          companyId,
          status: updated.status,
          reference: updated.reference,
          deliveryId: updated.id,
          eventId: statusEventId,
        })
      : null;
    // DEMO-3 : facture à la livraison, une tâche par passage ; une seule facture active par commande.
    const invoiceJob = input.status === "DELIVERED" && statusEventId
      ? await queueDeliveryInvoiceJob(tx, { companyId, orderId: delivery.orderId, passageKey: statusEventId })
      : null;

    return { updated, notificationJobId: notificationJob?.id ?? null, invoiceJobId: invoiceJob?.id ?? null };
  }, { maxWait: 10_000, timeout: 30_000 });

  if (notificationJobId) kickOperationJob(notificationJobId);
  if (invoiceJobId) kickOperationJob(invoiceJobId);
  return updated;
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

const DRIVER_ACTIVITY_SELECT = {
  id: true,
  firstName: true,
  lastName: true,
  email: true,
  phone: true,
  lastLoginAt: true,
} satisfies Prisma.UserSelect;

/** Réservé à l'auto-dispatch : état de service et dernière position, jamais renvoyés tels quels. */
const DRIVER_DISPATCH_POSITION_SELECT = {
  ...DRIVER_ACTIVITY_SELECT,
  settings: true,
  driverLocation: { select: { latitude: true, longitude: true, updatedAt: true } },
} satisfies Prisma.UserSelect;

type DriverActivityRow = Prisma.UserGetPayload<{ select: typeof DRIVER_ACTIVITY_SELECT }> &
  ReturnType<typeof emptyDriverStats>;
type DriverDispatchPositionRow = Prisma.UserGetPayload<{ select: typeof DRIVER_DISPATCH_POSITION_SELECT }> &
  ReturnType<typeof emptyDriverStats>;

export async function getCompanyDriversWithActivity(
  companyId: string,
  options: { withDispatchPosition: true }
): Promise<DriverDispatchPositionRow[]>;
// Dernière surcharge : celle que `ReturnType` retient pour les appelants existants.
export async function getCompanyDriversWithActivity(companyId: string): Promise<DriverActivityRow[]>;
export async function getCompanyDriversWithActivity(
  companyId: string,
  options?: { withDispatchPosition?: boolean }
): Promise<Array<DriverActivityRow | DriverDispatchPositionRow>> {
  const today = startOfToday();

  // Une seule requête utilisateurs, même filtre ; la position n'est lue que sur demande.
  const where = { companyId, status: "ACTIVE", role: { systemRole: "DRIVER" } } satisfies Prisma.UserWhereInput;
  const drivers: Array<Prisma.UserGetPayload<{ select: typeof DRIVER_ACTIVITY_SELECT }> & Partial<Pick<DriverDispatchPositionRow, "settings" | "driverLocation">>> =
    options?.withDispatchPosition
      ? await prisma.user.findMany({ where, select: DRIVER_DISPATCH_POSITION_SELECT, orderBy: { firstName: "asc" } })
      : await prisma.user.findMany({ where, select: DRIVER_ACTIVITY_SELECT, orderBy: { firstName: "asc" } });

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
  const today = startOfToday();
  const groups = await prisma.delivery.groupBy({
    by: ["status"],
    where: { driverId, OR: [
      { status: { in: ["ASSIGNED", "PURCHASING", "IN_DELIVERY"] } },
      { status: "DELIVERED", completedAt: { gte: today } },
    ] },
    _count: { _all: true },
  });
  const count = (status: DeliveryStatus) => groups.find((row) => row.status === status)?._count._all ?? 0;
  return { assigned: count("ASSIGNED"), inTransit: count("PURCHASING") + count("IN_DELIVERY"), deliveredToday: count("DELIVERED") };
}

export const DELIVERY_STATUS_LABELS: Record<DeliveryStatus, string> = FULFILLMENT_STATUS_LABELS;
