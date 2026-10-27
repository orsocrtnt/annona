import { createHash } from "node:crypto";
import { prisma } from "@/services/prisma/client";
import type { DeliveryStatus, OrderSource, OrderStatus, Prisma } from "@prisma/client";
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
import {
  enqueueAutoDispatchJob,
  kickOperationJob,
} from "@/domains/operations/operation-job.service";
import { queueDeliveryStatusNotification } from "@/domains/client-portal/notify.service";
import { getCancellationBlockReason } from "@/domains/delivery/dispatch-policy";
import {
  ORDER_EXPORT_CHUNK_SIZE,
  type OrderHistoryPage,
  type OrderHistoryQuery,
} from "@/lib/query/order-history";
import {
  assertCanCreateOrder,
  recordOrderCreatedUsage,
  resolveCompanySaasAccess,
} from "@/domains/saas/saas.service";

type CreateOrderOptions = CreateClientOrderInput & {
  recurringOrderId?: string;
  source?: OrderSource;
};

type CreateOrderRequest = {
  idempotencyKey?: string;
};

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([, child]) => child !== undefined)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, child]) => [key, canonicalize(child)])
    );
  }
  return value;
}

export function fingerprintOrderRequest(input: CreateOrderOptions) {
  return createHash("sha256")
    .update(JSON.stringify(canonicalize(input)))
    .digest("hex");
}

function isUniqueConstraintError(error: unknown) {
  return Boolean(
    error &&
    typeof error === "object" &&
    "code" in error &&
    error.code === "P2002"
  );
}

async function findIdempotentOrder(
  customerId: string,
  companyId: string,
  idempotencyKey: string,
  requestFingerprint: string
) {
  const existing = await prisma.order.findFirst({
    where: { customerId, companyId, idempotencyKey },
    include: {
      items: true,
      stops: { orderBy: { sequence: "asc" } },
    },
  });
  if (!existing) return null;
  if (existing.requestFingerprint !== requestFingerprint) {
    throw new Error("IDEMPOTENCY_KEY_REUSED");
  }
  return existing;
}

export async function getClientOrders(
  customerId: string,
  companyId: string,
  options?: { history?: boolean }
) {
  const historyStatuses = HISTORY_ORDER_STATUSES;
  return prisma.order.findMany({
    where: {
      customerId,
      companyId,
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

function orderHistoryDateRange(query: OrderHistoryQuery): Prisma.DateTimeFilter | undefined {
  if (!query.from && !query.to) return undefined;
  const range: Prisma.DateTimeFilter = {};
  if (query.from) range.gte = new Date(`${query.from}T00:00:00.000Z`);
  if (query.to) {
    const exclusiveEnd = new Date(`${query.to}T00:00:00.000Z`);
    exclusiveEnd.setUTCDate(exclusiveEnd.getUTCDate() + 1);
    range.lt = exclusiveEnd;
  }
  return range;
}

export function buildOrderHistoryWhere(
  scope: Prisma.OrderWhereInput,
  query: OrderHistoryQuery,
  statusScope?: Prisma.OrderWhereInput
): Prisma.OrderWhereInput {
  const filters: Prisma.OrderWhereInput[] = [scope];
  if (statusScope) filters.push(statusScope);
  if (query.status) filters.push({ status: query.status });
  if (query.category) filters.push({ deliveryCategory: query.category });
  const createdAt = orderHistoryDateRange(query);
  if (createdAt) filters.push({ createdAt });
  if (query.search) {
    filters.push({
      OR: [
        { reference: { contains: query.search, mode: "insensitive" } },
        { customerEmail: { contains: query.search, mode: "insensitive" } },
        { shippingAddress: { contains: query.search, mode: "insensitive" } },
        { shippingCity: { contains: query.search, mode: "insensitive" } },
        {
          customer: {
            is: {
              OR: [
                { firstName: { contains: query.search, mode: "insensitive" } },
                { lastName: { contains: query.search, mode: "insensitive" } },
                { email: { contains: query.search, mode: "insensitive" } },
              ],
            },
          },
        },
        { deliveries: { some: { reference: { contains: query.search, mode: "insensitive" } } } },
      ],
    });
  }
  return { AND: filters };
}

function orderHistoryPage<T>(items: T[], total: number, query: OrderHistoryQuery): OrderHistoryPage<T> {
  const totalPages = Math.max(1, Math.ceil(total / query.pageSize));
  return {
    items,
    page: query.page,
    pageSize: query.pageSize,
    total,
    totalPages,
    hasPreviousPage: query.page > 1,
    hasNextPage: query.page < totalPages,
  };
}

const CLIENT_ORDER_HISTORY_SELECT = {
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
} satisfies Prisma.OrderSelect;

const COMPANY_ORDER_HISTORY_SELECT = {
  id: true,
  reference: true,
  status: true,
  source: true,
  totalAmount: true,
  itemCount: true,
  createdAt: true,
  requestedDeliveryDate: true,
  deliveryCategory: true,
  // Adresse affichée sous le nom du client dans la liste des commandes.
  shippingAddress: true,
  shippingCity: true,
  pickupAddress: true,
  // Codes postaux lus par le sélecteur de chauffeur (zones de dispatch) : sans eux, « Aucun compatible ».
  shippingPostalCode: true,
  pickupPostalCode: true,
  customerEmail: true,
  customer: { select: { firstName: true, lastName: true, email: true } },
  deliveries: {
    select: {
      id: true,
      reference: true,
      status: true,
      driverId: true,
      driverName: true,
      postalCode: true,
      pickupPostalCode: true,
      missionStartedAt: true,
      missionAcceptedAt: true,
      driver: { select: { id: true, firstName: true, lastName: true } },
    },
  },
  _count: { select: { deliveries: true, invoices: true } },
} satisfies Prisma.OrderSelect;

function clientHistoryStatusScope(history: boolean | undefined): Prisma.OrderWhereInput {
  return {
    status: history
      ? { in: HISTORY_ORDER_STATUSES }
      : { notIn: HISTORY_ORDER_STATUSES },
  };
}

export async function listClientOrderHistory(
  customerId: string,
  companyId: string,
  query: OrderHistoryQuery
) {
  const where = buildOrderHistoryWhere(
    { customerId, companyId },
    query,
    clientHistoryStatusScope(query.history)
  );
  const [items, total] = await Promise.all([
    prisma.order.findMany({
      where,
      select: CLIENT_ORDER_HISTORY_SELECT,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
    }),
    prisma.order.count({ where }),
  ]);
  return orderHistoryPage(items, total, query);
}

export async function listCompanyOrderHistory(companyId: string, query: OrderHistoryQuery) {
  const where = buildOrderHistoryWhere({ companyId }, query);
  const [rawItems, total] = await Promise.all([
    prisma.order.findMany({
      where,
      select: COMPANY_ORDER_HISTORY_SELECT,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
    }),
    prisma.order.count({ where }),
  ]);
  const items = await resolveCustomersByEmail(rawItems, companyId);
  return orderHistoryPage(items, total, query);
}

export function csvCell(value: unknown) {
  let text = value == null ? "" : String(value);
  if (/^[\t\r\n ]*[=+\-@]/.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}

const ORDER_EXPORT_SELECT = {
  id: true,
  reference: true,
  status: true,
  source: true,
  deliveryCategory: true,
  totalAmount: true,
  itemCount: true,
  createdAt: true,
  requestedDeliveryDate: true,
  customerEmail: true,
  shippingAddress: true,
  shippingCity: true,
  shippingPostalCode: true,
  customer: { select: { firstName: true, lastName: true, email: true } },
} satisfies Prisma.OrderSelect;

export async function exportOrderHistoryCsv(
  companyId: string,
  query: OrderHistoryQuery,
  options?: { customerId?: string; includeCustomer?: boolean }
) {
  const statusScope = options?.customerId ? clientHistoryStatusScope(query.history) : undefined;
  const where = buildOrderHistoryWhere(
    { companyId, ...(options?.customerId ? { customerId: options.customerId } : {}) },
    query,
    statusScope
  );
  const header = [
    "Référence", "Statut", "Type", "Source", "Créée le", "Livraison demandée",
    ...(options?.includeCustomer ? ["Client", "E-mail client"] : []),
    "Adresse", "Ville", "Code postal", "Articles", "Montant",
  ];
  const lines = [`\uFEFF${header.map(csvCell).join(",")}`];
  let cursor: string | undefined;

  for (;;) {
    const rows = await prisma.order.findMany({
      where,
      select: ORDER_EXPORT_SELECT,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: ORDER_EXPORT_CHUNK_SIZE,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });
    for (const row of rows) {
      const customerName = row.customer
        ? `${row.customer.firstName} ${row.customer.lastName}`.trim()
        : "";
      const values = [
        row.reference,
        row.status,
        row.deliveryCategory,
        row.source,
        row.createdAt.toISOString(),
        row.requestedDeliveryDate?.toISOString() ?? "",
        ...(options?.includeCustomer
          ? [customerName, row.customer?.email ?? row.customerEmail ?? ""]
          : []),
        row.shippingAddress ?? "",
        row.shippingCity ?? "",
        row.shippingPostalCode ?? "",
        row.itemCount,
        row.totalAmount.toString(),
      ];
      lines.push(values.map(csvCell).join(","));
    }
    if (rows.length < ORDER_EXPORT_CHUNK_SIZE) break;
    cursor = rows.at(-1)?.id;
    if (!cursor) break;
  }

  return `${lines.join("\r\n")}\r\n`;
}

export async function getClientOrderById(customerId: string, companyId: string, orderId: string) {
  return prisma.order.findFirst({
    where: { id: orderId, customerId, companyId },
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

export async function getDeliveryReorderTemplate(
  customerId: string,
  companyId: string,
  deliveryId: string
) {
  const delivery = await prisma.delivery.findFirst({
    where: { id: deliveryId, customerId, companyId },
    select: {
      id: true,
      reference: true,
      orderId: true,
      deliveryCategory: true,
    },
  });

  if (!delivery) return null;

  const order = await getClientOrderById(customerId, companyId, delivery.orderId);
  if (!order) return null;

  return {
    deliveryId: delivery.id,
    deliveryReference: delivery.reference,
    formValues: buildReorderFormValues(order),
  };
}

export async function getOrderReorderTemplate(
  customerId: string,
  companyId: string,
  orderId: string
) {
  const order = await getClientOrderById(customerId, companyId, orderId);
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

export async function getClientOrderStats(customerId: string, companyId: string) {
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  const [orders, deliveries, nextDelivery] = await Promise.all([
    prisma.order.groupBy({ by: ["status"], where: { customerId, companyId }, _count: { _all: true } }),
    prisma.delivery.groupBy({
      by: ["status"],
      where: { customerId, companyId, OR: [
        { status: { in: ["ASSIGNED", "PURCHASING", "IN_DELIVERY"] } },
        { status: "DELIVERED", completedAt: { gte: monthStart } },
      ] },
      _count: { _all: true },
    }),
    prisma.delivery.findFirst({
      where: { customerId, companyId, status: { in: ["ASSIGNED", "PURCHASING", "IN_DELIVERY", "PENDING"] }, estimatedArrival: { not: null } },
      orderBy: { estimatedArrival: "asc" }, select: { estimatedArrival: true },
    }),
  ]);
  const count = (status: DeliveryStatus) => deliveries.find((row) => row.status === status)?._count._all ?? 0;
  return {
    activeOrders: orders.filter((row) => ACTIVE_ORDER_STATUSES.includes(row.status)).reduce((sum, row) => sum + row._count._all, 0),
    orderCount: orders.reduce((sum, row) => sum + row._count._all, 0),
    inDelivery: count("ASSIGNED") + count("PURCHASING") + count("IN_DELIVERY"),
    deliveredThisMonth: count("DELIVERED"), nextDeliveryEta: nextDelivery?.estimatedArrival ?? null,
  };
}

export async function getClientOrderCount(customerId: string, companyId: string) {
  return prisma.order.count({ where: { customerId, companyId } });
}

export async function createClientOrder(
  customerId: string,
  companyId: string,
  email: string,
  input: CreateOrderOptions,
  request: CreateOrderRequest = {}
) {
  const idempotencyKey = request.idempotencyKey?.trim() || null;
  const requestFingerprint = idempotencyKey
    ? fingerprintOrderRequest(input)
    : null;
  if (idempotencyKey && requestFingerprint) {
    const existing = await findIdempotentOrder(
      customerId,
      companyId,
      idempotencyKey,
      requestFingerprint
    );
    if (existing) return existing;
  }

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

    try {
      return await prisma.$transaction(async (tx) => {
        await assertCanCreateOrder(companyId, tx);
        const order = await tx.order.create({
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
            idempotencyKey,
            requestFingerprint,
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
        await recordOrderCreatedUsage(tx, { companyId, orderId: order.id });
        return order;
      }, { maxWait: 10_000, timeout: 30_000 });
    } catch (error) {
      if (idempotencyKey && requestFingerprint && isUniqueConstraintError(error)) {
        const existing = await findIdempotentOrder(
          customerId,
          companyId,
          idempotencyKey,
          requestFingerprint
        );
        if (existing) return existing;
      }
      throw error;
    }
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

  let transactionResult;
  try {
    transactionResult = await prisma.$transaction(async (tx) => {
    const saasAccess = await assertCanCreateOrder(companyId, tx);
    const createdOrder = await tx.order.create({
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
        idempotencyKey,
        requestFingerprint,
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

    const order = createdOrder;
    await recordOrderCreatedUsage(tx, { companyId, orderId: order.id });

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
        await tx.orderItem.createMany({ data: itemRows });
      }

      order.items = await tx.orderItem.findMany({ where: { orderId: order.id } });
    }

    const delivery = await tx.delivery.create({
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
          create: isCourier
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

      const operationJob = saasAccess.features.has("auto_dispatch")
        ? await enqueueAutoDispatchJob(tx, {
            companyId,
            deliveryId: delivery.id,
          })
        : null;

      return { order, delivery, operationJobId: operationJob?.id ?? null };
    // Une dizaine d'allers-retours séquentiels : le délai Prisma par défaut (5 s) expirait
    // sur la base distante avec le dispatch automatique (ONBOARD-1, DISPATCH-3).
    }, { maxWait: 10_000, timeout: 30_000 });
  } catch (error) {
    if (idempotencyKey && requestFingerprint && isUniqueConstraintError(error)) {
      const existing = await findIdempotentOrder(
        customerId,
        companyId,
        idempotencyKey,
        requestFingerprint
      );
      if (existing) return existing;
    }
    throw error;
  }

  const { order, operationJobId } = transactionResult;

  if (input.saveAddress && input.addressLabel) {
    try {
      await createClientAddress(customerId, {
        label: input.addressLabel,
        address: input.shippingAddress!,
        city: input.shippingCity!,
        postalCode: input.shippingPostalCode!,
      });
    } catch (error) {
      console.error("Address save failed after order creation", order.id, error);
    }
  }

  if (operationJobId) kickOperationJob(operationJobId);

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
          missionStartedAt: true,
          missionAcceptedAt: true,
          driver: { select: { id: true, firstName: true, lastName: true } },
        },
      },
      _count: { select: { deliveries: true, invoices: true } },
    },
    orderBy: { createdAt: "desc" },
    take: COMPANY_ORDERS_TAKE,
  });

  return resolveCustomersByEmail(orders, companyId);
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
          updatedAt: true,
          createdAt: true,
          notes: true,
        },
      },
    },
  });
}

export async function getCompanyOrderStats(companyId: string) {
  const [pendingOrders, groups] = await Promise.all([
    prisma.order.count({ where: { companyId, status: "PENDING" } }),
    prisma.delivery.groupBy({
      by: ["status"],
      where: { companyId, OR: [
        { status: { in: ["PENDING", "ASSIGNED", "PURCHASING", "IN_DELIVERY"] } },
        { status: "DELIVERED", completedAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) } },
      ] },
      _count: { _all: true },
    }),
  ]);
  const count = (status: DeliveryStatus) => groups.find((row) => row.status === status)?._count._all ?? 0;
  return { pendingOrders, activeDeliveries: count("ASSIGNED") + count("PURCHASING") + count("IN_DELIVERY"), deliveredToday: count("DELIVERED"), unassigned: count("PENDING") };
}

function syncDeliveryStatus(orderStatus: OrderStatus): DeliveryStatus {
  return orderStatus as DeliveryStatus;
}

async function cancelCompanyOrderBeforeMissionStart(
  companyId: string,
  orderId: string
) {
  const result = await prisma.$transaction(async (tx) => {
    const order = await tx.order.findFirst({
      where: { id: orderId, companyId },
      include: {
        deliveries: { orderBy: { createdAt: "asc" } },
        invoices: { orderBy: { createdAt: "asc" } },
      },
    });
    if (!order) {
      return { found: false, operationJobIds: [] as string[] };
    }
    if (order.status === "CANCELLED") {
      return { found: true, operationJobIds: [] as string[] };
    }

    if (["PURCHASING", "IN_DELIVERY"].includes(order.status)) {
      throw new Error("CANCELLATION_REASON_REQUIRED");
    }
    if (["DELIVERED", "INVOICED", "PAID", "FAILED"].includes(order.status)) {
      throw new Error("ORDER_NOT_CANCELLABLE");
    }
    if (order.invoices.some((invoice) => invoice.status === "PAID")) {
      throw new Error("ORDER_PAID");
    }

    for (const delivery of order.deliveries) {
      const blockReason = getCancellationBlockReason(delivery);
      if (blockReason) throw new Error(blockReason);
    }

    const deliveriesToCancel = order.deliveries.filter(
      (delivery) => delivery.status !== "CANCELLED"
    );
    for (const delivery of deliveriesToCancel) {
      const claim = await tx.delivery.updateMany({
        where: {
          id: delivery.id,
          companyId,
          orderId,
          status: delivery.status,
          driverId: delivery.driverId,
          missionStartedAt: delivery.missionStartedAt,
          updatedAt: delivery.updatedAt,
        },
        data: {
          status: "CANCELLED",
          driverId: null,
        },
      });
      if (claim.count === 0) {
        throw new Error("DELIVERY_STATUS_CONFLICT");
      }
    }

    for (const invoice of order.invoices) {
      if (invoice.status === "CANCELLED") continue;
      const claim = await tx.invoice.updateMany({
        where: {
          id: invoice.id,
          companyId,
          orderId,
          status: invoice.status,
          updatedAt: invoice.updatedAt,
        },
        data: { status: "CANCELLED" },
      });
      if (claim.count === 0) {
        const currentInvoice = await tx.invoice.findFirst({
          where: { id: invoice.id, companyId, orderId },
          select: { status: true },
        });
        if (currentInvoice?.status === "PAID") throw new Error("ORDER_PAID");
        throw new Error("INVOICE_STATUS_CONFLICT");
      }
    }

    const orderClaim = await tx.order.updateMany({
      where: {
        id: orderId,
        companyId,
        status: order.status,
        updatedAt: order.updatedAt,
      },
      data: { status: "CANCELLED" },
    });
    if (orderClaim.count === 0) {
      throw new Error("ORDER_STATUS_CONFLICT");
    }

    const operationJobIds: string[] = [];
    for (const delivery of deliveriesToCancel) {
      const trackingEvent = await tx.trackingEvent.create({
        data: {
          deliveryId: delivery.id,
          label: getFulfillmentStatusLabel("CANCELLED", order.deliveryCategory),
          description: delivery.driverName
            ? `Commande annulée avant le départ — chauffeur précédemment assigné : ${delivery.driverName}`
            : "Commande annulée avant le départ par l’administrateur",
        },
      });
      const notificationJob = await queueDeliveryStatusNotification(tx, {
        customerId: order.customerId,
        companyId,
        status: "CANCELLED",
        reference: delivery.reference,
        deliveryId: delivery.id,
        eventId: trackingEvent.id,
      });
      if (notificationJob) operationJobIds.push(notificationJob.id);
    }

    return { found: true, operationJobIds };
  }, { maxWait: 10_000, timeout: 30_000 });

  result.operationJobIds.forEach(kickOperationJob);
  if (!result.found) return null;
  return getCompanyOrderById(companyId, orderId);
}

export async function updateCompanyOrderStatus(
  companyId: string,
  orderId: string,
  status: OrderStatus
) {
  if (status === "INVOICED" || status === "PAID") {
    throw new Error("BILLING_STATUS_NOT_LOGISTICS");
  }
  if (status === "ASSIGNED") {
    throw new Error("ORDER_ASSIGNMENT_REQUIRED");
  }
  if (status === "CANCELLED") {
    return cancelCompanyOrderBeforeMissionStart(companyId, orderId);
  }

  const order = await prisma.order.findFirst({
    where: { id: orderId, companyId },
    include: {
      deliveries: true,
      invoices: true,
      stops: { orderBy: { sequence: "asc" } },
    },
  });
  if (!order) return null;

  if (
    order.status === "QUOTE_REQUESTED" &&
    order.deliveryCategory === "SPECIAL_MISSION" &&
    status !== "QUOTE_REQUESTED" &&
    status !== "PENDING"
  ) {
    throw new Error("SPECIAL_QUOTE_TRANSITION_INVALID");
  }

  const acceptingQuote =
    order.status === "QUOTE_REQUESTED" &&
    status === "PENDING" &&
    order.deliveryCategory === "SPECIAL_MISSION" &&
    order.deliveries.length === 0;

  if (order.status === status && !acceptingQuote) {
    return getCompanyOrderById(companyId, orderId);
  }

  const quoteStops = acceptingQuote ? order.stops : [];
  const quoteFirstStop = quoteStops[0];
  const quoteLastStop = quoteStops[quoteStops.length - 1] ?? quoteFirstStop;
  const quoteDeliveryReference = acceptingQuote
    ? await generateDeliveryReference()
    : null;
  const quoteDeliveryCoords = acceptingQuote
    ? await resolveDeliveryCoordinateFields({
        address: quoteLastStop?.address ?? order.shippingAddress ?? "",
        city: quoteLastStop?.city ?? order.shippingCity,
        postalCode: quoteLastStop?.postalCode ?? order.shippingPostalCode,
        pickupAddress: quoteStops.length > 1 ? quoteFirstStop?.address ?? null : null,
        pickupCity: quoteStops.length > 1 ? quoteFirstStop?.city ?? null : null,
        pickupPostalCode:
          quoteStops.length > 1 ? quoteFirstStop?.postalCode ?? null : null,
        includePickup: quoteStops.length > 1,
      })
    : null;

  const result = await prisma.$transaction(async (tx) => {
    const operationJobIds: string[] = [];
    const orderInclude = {
      items: true,
      stops: { orderBy: { sequence: "asc" as const } },
      customer: { select: { id: true, firstName: true, lastName: true, email: true, phone: true } },
      deliveries: {
        include: {
          driver: { select: { id: true, firstName: true, lastName: true, phone: true } },
        },
      },
    };

    const claim = await tx.order.updateMany({
      where: { id: orderId, companyId, status: order.status },
      data: { status },
    });
    if (claim.count === 0) {
      const currentOrder = await tx.order.findFirst({
        where: { id: orderId, companyId },
        include: orderInclude,
      });
      if (currentOrder && currentOrder.status !== status) {
        throw new Error("ORDER_STATUS_CONFLICT");
      }
      return { order: currentOrder, operationJobIds };
    }

    const updated = await tx.order.findUniqueOrThrow({
      where: { id: orderId },
      include: orderInclude,
    });

    if (acceptingQuote) {
      const saasAccess = await resolveCompanySaasAccess(companyId, new Date(), tx);
      const delivery = await tx.delivery.create({
        data: {
          reference: quoteDeliveryReference!,
          status: "PENDING",
          deliveryCategory: "SPECIAL_MISSION",
          pickupAddress:
            quoteStops.length > 1 ? quoteFirstStop?.address ?? null : null,
          pickupCity: quoteStops.length > 1 ? quoteFirstStop?.city ?? null : null,
          pickupPostalCode:
            quoteStops.length > 1 ? quoteFirstStop?.postalCode ?? null : null,
          pickupLatitude: quoteDeliveryCoords!.pickupLatitude,
          pickupLongitude: quoteDeliveryCoords!.pickupLongitude,
          address: quoteLastStop?.address ?? order.shippingAddress ?? "",
          city: quoteLastStop?.city ?? order.shippingCity,
          postalCode: quoteLastStop?.postalCode ?? order.shippingPostalCode,
          latitude: quoteDeliveryCoords!.latitude,
          longitude: quoteDeliveryCoords!.longitude,
          companyId,
          orderId: order.id,
          customerId: order.customerId,
          scheduledAt:
            order.requestedDeliveryDate ??
            new Date(Date.now() + 48 * 60 * 60 * 1000),
          trackingEvents: {
            create: [
              {
                label: "Accord confirmé hors TutelLiv",
                description:
                  "Mission spéciale convertie manuellement — en attente d'assignation",
              },
            ],
          },
        },
      });

      if (saasAccess.features.has("auto_dispatch")) {
        const operationJob = await enqueueAutoDispatchJob(tx, {
          companyId,
          deliveryId: delivery.id,
        });
        operationJobIds.push(operationJob.id);
      }
    }

    for (const delivery of order.deliveries) {
      const deliveryUpdate: {
        status: DeliveryStatus;
        completedAt?: Date | null;
      } = {
        status: syncDeliveryStatus(status),
        completedAt:
          status === "DELIVERED" || status === "FAILED"
            ? delivery.completedAt ?? new Date()
            : delivery.completedAt,
      };
      await tx.delivery.update({
        where: { id: delivery.id },
        data: deliveryUpdate,
      });
      const trackingEvent = await tx.trackingEvent.create({
        data: {
          deliveryId: delivery.id,
          label: getFulfillmentStatusLabel(status, order.deliveryCategory),
          description: "Statut mis à jour par l'administrateur",
        },
      });
      const notificationJob = await queueDeliveryStatusNotification(tx, {
        customerId: order.customerId,
        companyId,
        status: deliveryUpdate.status,
        reference: delivery.reference,
        deliveryId: delivery.id,
        eventId: trackingEvent.id,
      });
      if (notificationJob) operationJobIds.push(notificationJob.id);
    }

    if (acceptingQuote) {
      const refreshedOrder = await tx.order.findFirst({
        where: { id: orderId },
        include: orderInclude,
      });
      return { order: refreshedOrder, operationJobIds };
    }

    return { order: updated, operationJobIds };
  }, { maxWait: 10_000, timeout: 30_000 });

  result.operationJobIds.forEach(kickOperationJob);
  return result.order;
}

export async function deleteCompanyOrder(companyId: string, orderId: string) {
  return prisma.$transaction(async (tx) => {
    const order = await tx.order.findFirst({
      where: { id: orderId, companyId },
      select: {
        id: true,
        reference: true,
        status: true,
        updatedAt: true,
        _count: { select: { deliveries: true, invoices: true } },
      },
    });
    if (!order) return null;

    if (
      order.status !== "QUOTE_REQUESTED" ||
      order._count.deliveries > 0 ||
      order._count.invoices > 0
    ) {
      throw new Error("ORDER_HAS_OPERATIONAL_HISTORY");
    }

    const deleted = await tx.order.deleteMany({
      where: {
        id: orderId,
        companyId,
        status: "QUOTE_REQUESTED",
        updatedAt: order.updatedAt,
        deliveries: { none: {} },
        invoices: { none: {} },
      },
    });
    if (deleted.count === 0) {
      const stillExists = await tx.order.count({ where: { id: orderId, companyId } });
      if (stillExists === 0) return null;
      throw new Error("ORDER_HAS_OPERATIONAL_HISTORY");
    }

    return { id: order.id, reference: order.reference };
  }, { maxWait: 10_000, timeout: 30_000 });
}

export const ORDER_STATUS_LABELS = FULFILLMENT_STATUS_LABELS;
