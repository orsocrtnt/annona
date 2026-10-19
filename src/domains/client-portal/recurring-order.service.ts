import { prisma } from "@/services/prisma/client";
import type { DeliveryCategory, RecurrenceFrequency, RecurrenceUnit } from "@prisma/client";
import type {
  CreateRecurringOrderInput,
  UpdateRecurringOrderInput,
} from "@/lib/validations/order";
import { createClientOrder } from "@/domains/order/order.service";
import { assertDeliveryCategoryEnabled } from "@/domains/company/company-settings.service";
import { CLIENT_RECURRING_TAKE, RECURRING_DUE_TAKE } from "@/lib/query/list-limits";
import {
  firstPickupFields,
  resolveRecurringPickupStops,
  type StoredPickupStop,
} from "@/lib/order/recurring-pickups";
import {
  addRecurringInterval,
  parseRecurringCalendarDate,
  recurringCalendarDateValue,
} from "@/lib/order/recurrence-schedule";

const RECURRING_MAX_OCCURRENCES_PER_RUN = 500;

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
    take: CLIENT_RECURRING_TAKE,
  });
}

export async function createClientRecurringOrder(
  customerId: string,
  companyId: string,
  email: string,
  input: CreateRecurringOrderInput
) {
  await assertDeliveryCategoryEnabled(companyId, input.deliveryCategory);

  const startAt = parseRecurringCalendarDate(input.startAt);
  const endAt = input.endAt ? parseRecurringCalendarDate(input.endAt, true) : null;

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
      ...buildOrderPayload({ ...recurring, items }, recurringCalendarDateValue(startAt)),
    }, {
      idempotencyKey: `recurring:${recurring.id}:${startAt.toISOString()}`,
    });
    const followingRunAt = addRecurringInterval(
      startAt,
      input.intervalValue,
      input.intervalUnit,
      startAt
    );
    await prisma.recurringOrder.update({
      where: { id: recurring.id },
      data: {
        nextRunAt: followingRunAt,
        status: endAt && followingRunAt > endAt ? "CANCELLED" : undefined,
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
  const updatedStartAt = input.startAt
    ? parseRecurringCalendarDate(input.startAt)
    : undefined;

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
      startAt: updatedStartAt,
      nextRunAt: updatedStartAt,
      endAt:
        input.endAt === undefined
          ? undefined
          : input.endAt === null
            ? null
            : parseRecurringCalendarDate(input.endAt, true),
      frequency:
        input.intervalValue && input.intervalUnit
          ? intervalToLegacyFrequency(input.intervalValue, input.intervalUnit)
          : undefined,
    },
  });
}

export type RecurringProcessingSummary = {
  processed: number;
  failed: number;
  cancelled: number;
  skipped: number;
  hasMore: boolean;
};

export async function processDueRecurringOrders(options: {
  now?: Date;
  maxOccurrences?: number;
} = {}): Promise<RecurringProcessingSummary> {
  const now = options.now ?? new Date();
  const maxOccurrences = Math.max(
    1,
    Math.min(options.maxOccurrences ?? RECURRING_MAX_OCCURRENCES_PER_RUN, RECURRING_MAX_OCCURRENCES_PER_RUN)
  );
  const failedRecurringIds = new Set<string>();
  const summary: RecurringProcessingSummary = {
    processed: 0,
    failed: 0,
    cancelled: 0,
    skipped: 0,
    hasMore: false,
  };

  while (
    summary.processed + summary.cancelled + summary.skipped + summary.failed < maxOccurrences
  ) {
    const remaining =
      maxOccurrences -
      summary.processed -
      summary.cancelled -
      summary.skipped -
      summary.failed;
    const due = await prisma.recurringOrder.findMany({
      where: {
        status: "ACTIVE",
        nextRunAt: { lte: now },
        startAt: { lte: now },
        id: failedRecurringIds.size > 0
          ? { notIn: [...failedRecurringIds] }
          : undefined,
      },
      include: { customer: true },
      orderBy: [{ nextRunAt: "asc" }, { id: "asc" }],
      take: Math.min(RECURRING_DUE_TAKE, remaining),
    });
    if (due.length === 0) break;

    for (const recurring of due) {
      const occurrenceAt = recurring.nextRunAt;
      const occurrenceKey = `recurring:${recurring.id}:${occurrenceAt.toISOString()}`;

      if (
        recurring.deliveryCategory === "SPECIAL_MISSION" ||
        (recurring.endAt && occurrenceAt > recurring.endAt)
      ) {
        const cancelled = await prisma.recurringOrder.updateMany({
          where: { id: recurring.id, status: "ACTIVE", nextRunAt: occurrenceAt },
          data: { status: "CANCELLED" },
        });
        if (cancelled.count === 1) summary.cancelled += 1;
        else summary.skipped += 1;
        continue;
      }

      try {
        // L'Order et sa livraison sont l'occurrence durable. La clé associe de
        // façon unique la récurrence et la date. On avance seulement après leur
        // création atomique : un crash intermédiaire rejoue la même occurrence.
        await createClientOrder(
          recurring.customerId,
          recurring.companyId,
          recurring.customer.email,
          {
            ...buildOrderPayload(recurring, recurringCalendarDateValue(occurrenceAt)),
          },
          { idempotencyKey: occurrenceKey }
        );

        const { value, unit } = resolveRecurringInterval(recurring);
        const nextRunAt = addRecurringInterval(
          occurrenceAt,
          value,
          unit,
          recurring.startAt
        );
        const willCancel = Boolean(recurring.endAt && nextRunAt > recurring.endAt);
        const advanced = await prisma.recurringOrder.updateMany({
          where: { id: recurring.id, status: "ACTIVE", nextRunAt: occurrenceAt },
          data: willCancel ? { status: "CANCELLED", nextRunAt } : { nextRunAt },
        });
        if (advanced.count === 1) summary.processed += 1;
        else summary.skipped += 1;
      } catch (error) {
        failedRecurringIds.add(recurring.id);
        summary.failed += 1;
        console.error("Recurring occurrence processing failed", occurrenceKey, error);
      }
    }
  }

  const pending = await prisma.recurringOrder.findFirst({
    where: {
      status: "ACTIVE",
      nextRunAt: { lte: now },
      startAt: { lte: now },
    },
    select: { id: true },
  });
  summary.hasMore = Boolean(pending);
  return summary;
}
