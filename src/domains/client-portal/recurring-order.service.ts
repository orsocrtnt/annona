import { prisma } from "@/services/prisma/client";
import type { DeliveryCategory, RecurrenceFrequency, RecurrenceUnit } from "@prisma/client";
import type {
  CreateRecurringOrderInput,
  UpdateRecurringOrderInput,
} from "@/lib/validations/order";
import { createClientOrder } from "@/domains/order/order.service";
import { assertDeliveryCategoryEnabled } from "@/domains/company/company-settings.service";
import {
  firstPickupFields,
  resolveRecurringPickupStops,
  type StoredPickupStop,
} from "@/lib/order/recurring-pickups";

function addInterval(date: Date, value: number, unit: RecurrenceUnit): Date {
  const next = new Date(date);
  if (unit === "DAYS") next.setDate(next.getDate() + value);
  else if (unit === "WEEKS") next.setDate(next.getDate() + value * 7);
  else next.setMonth(next.getMonth() + value);
  return next;
}

function intervalToLegacyFrequency(
  value: number,
  unit: RecurrenceUnit
): RecurrenceFrequency {
  if (unit === "WEEKS" && value === 1) return "WEEKLY";
  if (unit === "WEEKS" && value === 2) return "BIWEEKLY";
  if (unit === "MONTHS" && value === 1) return "MONTHLY";
  return "WEEKLY";
}

export function resolveRecurringInterval(recurring: {
  intervalValue: number;
  intervalUnit: RecurrenceUnit;
  frequency: RecurrenceFrequency;
}) {
  return {
    value: recurring.intervalValue,
    unit: recurring.intervalUnit,
  };
}

function normalizeItems(
  items: { name: string; quantity: number; estimatedPrice?: number }[],
  deliveryCategory: DeliveryCategory,
  pickupStops: StoredPickupStop[] = []
) {
  if (deliveryCategory === "COURIER") {
    const fromStops = pickupStops.flatMap((stop) => stop.items ?? []);
    if (fromStops.length > 0) return fromStops;
    return [{ name: "Course collecte → livraison", quantity: 1 }];
  }
  if (items.length > 0) return items;
  return items;
}

function toDateInputValue(date: Date) {
  return date.toISOString().slice(0, 10);
}

function assertRecurringCategory(
  category: import("@prisma/client").DeliveryCategory
): asserts category is "STANDARD" | "COURIER" {
  if (category === "SPECIAL_MISSION") {
    throw new Error("Les missions spéciales ne peuvent pas être récurrentes");
  }
}

function buildOrderPayload(
  recurring: {
    deliveryCategory: DeliveryCategory;
    pickupAddress: string | null;
    pickupCity: string | null;
    pickupPostalCode: string | null;
    pickupInstructions: string | null;
    pickupStops: unknown;
    shippingAddress: string;
    shippingCity: string | null;
    shippingPostalCode: string | null;
    deliveryInstructions: string | null;
    notes: string | null;
    items: unknown;
    id: string;
  },
  requestedDeliveryDate: string
) {
  const pickupStops = resolveRecurringPickupStops(recurring);

  const items = normalizeItems(
    (recurring.items as { name: string; quantity: number; estimatedPrice?: number }[]).map(
      (item) => ({
        name: item.name,
        quantity: item.quantity,
        estimatedPrice: item.estimatedPrice ?? undefined,
      })
    ),
    recurring.deliveryCategory,
    pickupStops
  ).map((item) => ({
    name: item.name,
    quantity: item.quantity,
    estimatedPrice: item.estimatedPrice ?? undefined,
  }));

  return {
    deliveryCategory: recurring.deliveryCategory,
    items,
    stops: undefined,
    pickupStops: pickupStops.length ? pickupStops : undefined,
    pickupAddress: recurring.pickupAddress ?? undefined,
    pickupCity: recurring.pickupCity ?? undefined,
    pickupPostalCode: recurring.pickupPostalCode ?? undefined,
    pickupInstructions: recurring.pickupInstructions ?? undefined,
    shippingAddress: recurring.shippingAddress,
    shippingCity: recurring.shippingCity ?? "",
    shippingPostalCode: recurring.shippingPostalCode ?? "",
    deliveryInstructions: recurring.deliveryInstructions ?? undefined,
    notes: recurring.notes ?? undefined,
    requestedDeliveryDate,
    recurringOrderId: recurring.id,
  };
}

function serializePickupStops(stops: StoredPickupStop[]) {
  return stops.map((stop, index) => ({
    label: stop.label?.trim() || `Collecte ${index + 1}`,
    address: stop.address,
    city: stop.city ?? "",
    postalCode: stop.postalCode ?? "",
    instructions: stop.instructions ?? undefined,
    items: (stop.items ?? []).map((item) => ({
      name: item.name,
      quantity: item.quantity,
      estimatedPrice: item.estimatedPrice ?? undefined,
    })),
  }));
}

export async function getClientRecurringOrders(customerId: string) {
  return prisma.recurringOrder.findMany({
    where: { customerId },
    orderBy: { createdAt: "desc" },
  });
}

export async function createClientRecurringOrder(
  customerId: string,
  companyId: string,
  email: string,
  input: CreateRecurringOrderInput
) {
  await assertDeliveryCategoryEnabled(companyId, input.deliveryCategory);

  const startAt = new Date(input.startAt);
  startAt.setHours(0, 0, 0, 0);
  const endAt = input.endAt ? new Date(input.endAt) : null;
  if (endAt) endAt.setHours(23, 59, 59, 999);

  const items = normalizeItems(input.items, input.deliveryCategory);
  const nextRunAt = startAt;
  const pickupStops =
    input.deliveryCategory === "COURIER" ? serializePickupStops(input.pickupStops ?? []) : [];
  const pickupFields =
    input.deliveryCategory === "COURIER" ? firstPickupFields(pickupStops) : {
      pickupAddress: input.pickupAddress ?? null,
      pickupCity: input.pickupCity ?? null,
      pickupPostalCode: input.pickupPostalCode ?? null,
      pickupInstructions: input.pickupInstructions ?? null,
    };

  const recurring = await prisma.recurringOrder.create({
    data: {
      label: input.label,
      frequency: intervalToLegacyFrequency(input.intervalValue, input.intervalUnit),
      intervalValue: input.intervalValue,
      intervalUnit: input.intervalUnit,
      deliveryCategory: input.deliveryCategory,
      pickupAddress: pickupFields.pickupAddress,
      pickupCity: pickupFields.pickupCity,
      pickupPostalCode: pickupFields.pickupPostalCode,
      pickupInstructions: pickupFields.pickupInstructions,
      pickupStops: pickupStops.length > 0 ? pickupStops : undefined,
      shippingAddress: input.shippingAddress,
      shippingCity: input.shippingCity,
      shippingPostalCode: input.shippingPostalCode,
      deliveryInstructions: input.deliveryInstructions,
      notes: input.notes,
      items,
      startAt,
      nextRunAt,
      endAt,
      companyId,
      customerId,
    },
  });

  const now = new Date();
  if (startAt <= now && (!endAt || endAt >= now)) {
    assertRecurringCategory(recurring.deliveryCategory);
    await createClientOrder(customerId, companyId, email, {
      ...buildOrderPayload({ ...recurring, items }, toDateInputValue(startAt)),
    });
    await prisma.recurringOrder.update({
      where: { id: recurring.id },
      data: {
        nextRunAt: addInterval(startAt, input.intervalValue, input.intervalUnit),
      },
    });
  }

  return prisma.recurringOrder.findUnique({ where: { id: recurring.id } });
}

export async function updateClientRecurringOrder(
  customerId: string,
  recurringId: string,
  input: UpdateRecurringOrderInput
) {
  const existing = await prisma.recurringOrder.findFirst({
    where: { id: recurringId, customerId },
  });
  if (!existing) return null;

  if (input.deliveryCategory) {
    await assertDeliveryCategoryEnabled(existing.companyId, input.deliveryCategory);
  }

  const pickupStopsInput =
    input.pickupStops !== undefined
      ? serializePickupStops(input.pickupStops)
      : undefined;
  const pickupFields =
    pickupStopsInput !== undefined
      ? firstPickupFields(pickupStopsInput)
      : null;

  return prisma.recurringOrder.update({
    where: { id: recurringId },
    data: {
      status: input.status,
      label: input.label,
      deliveryCategory: input.deliveryCategory,
      intervalValue: input.intervalValue,
      intervalUnit: input.intervalUnit,
      pickupAddress: pickupFields?.pickupAddress ?? input.pickupAddress,
      pickupCity: pickupFields?.pickupCity ?? input.pickupCity,
      pickupPostalCode: pickupFields?.pickupPostalCode ?? input.pickupPostalCode,
      pickupInstructions: pickupFields?.pickupInstructions ?? input.pickupInstructions,
      pickupStops: pickupStopsInput,
      shippingAddress: input.shippingAddress,
      shippingCity: input.shippingCity,
      shippingPostalCode: input.shippingPostalCode,
      deliveryInstructions: input.deliveryInstructions,
      notes: input.notes,
      items: input.items ?? undefined,
      startAt: input.startAt
        ? (() => {
            const d = new Date(input.startAt);
            d.setHours(0, 0, 0, 0);
            return d;
          })()
        : undefined,
      endAt:
        input.endAt === undefined
          ? undefined
          : input.endAt === null
            ? null
            : new Date(input.endAt),
      frequency:
        input.intervalValue && input.intervalUnit
          ? intervalToLegacyFrequency(input.intervalValue, input.intervalUnit)
          : undefined,
    },
  });
}

export async function processDueRecurringOrders() {
  const now = new Date();
  const due = await prisma.recurringOrder.findMany({
    where: {
      status: "ACTIVE",
      nextRunAt: { lte: now },
      startAt: { lte: now },
      OR: [{ endAt: null }, { endAt: { gte: now } }],
    },
    include: { customer: true },
  });

  let processed = 0;

  for (const recurring of due) {
    const { value, unit } = resolveRecurringInterval(recurring);

    if (recurring.deliveryCategory === "SPECIAL_MISSION") {
      continue;
    }

    const nextRunAt = addInterval(recurring.nextRunAt, value, unit);
    const willCancel = Boolean(recurring.endAt && nextRunAt > recurring.endAt);

    // Claim atomique : seul le process qui réussit ce bump traite l'occurrence
    // (évite les doublons si le cron et une visite du portail coïncident).
    const claim = await prisma.recurringOrder.updateMany({
      where: { id: recurring.id, status: "ACTIVE", nextRunAt: recurring.nextRunAt },
      data: willCancel ? { status: "CANCELLED", nextRunAt } : { nextRunAt },
    });
    if (claim.count === 0) continue;

    await createClientOrder(recurring.customerId, recurring.companyId, recurring.customer.email, {
      ...buildOrderPayload(recurring, toDateInputValue(recurring.nextRunAt)),
    });
    processed += 1;
  }

  return processed;
}
