/**
 * Commande récurrente du client (CLI-09, RG-04) : commande type (lignes), jours de livraison, créneau,
 * active ou suspendue. Ce module enregistre seulement la commande type ; la génération à l'heure
 * limite, uniquement si aucune commande manuelle n'existe pour le jour, relève de LOCK-1.
 */
import type { PrismaClient } from "@prisma/client";
import { prisma } from "@/services/prisma/client";
import { computeTotals, loadAppliedPrices } from "@/domains/catalog/pricing";
import { assertLines, clientSlotLabel, findMerchantSlot, type MerchantRef } from "@/domains/order/merchant-order.service";
import type { PortalRecurringOrder } from "@/domains/order/merchant-order.types";
import { DomainRuleError } from "@/lib/errors/domain-rule-error";
import { fr } from "@/lib/i18n/fr";
import type { RecurringOrderInput, UpdateRecurringOrderInput } from "@/lib/validations/order";

export type RecurringDb = Pick<
  PrismaClient,
  "merchant" | "slot" | "product" | "merchantPrice" | "recurringOrder" | "recurringOrderLine" | "$transaction"
>;

const t = fr.recurring.errors;

function normalizeWeekdays(weekdays: readonly number[]): number[] {
  const unique = [...new Set(weekdays)].filter((day) => Number.isInteger(day) && day >= 1 && day <= 7).sort((a, b) => a - b);
  if (unique.length === 0) throw new DomainRuleError(400, t.noWeekday, "NO_WEEKDAY");
  return unique;
}

/** Moments demandés : `slotIds` (matin, soir ou les deux) ou, pour compatibilité, `slotId`. */
function requestedSlots(input: { slotId?: string; slotIds?: string[] }): string[] | undefined {
  if (input.slotIds?.length) return [...new Set(input.slotIds)];
  return input.slotId ? [input.slotId] : undefined;
}

async function assertRefs(db: RecurringDb, actor: MerchantRef, input: { slotIds?: string[]; lines?: RecurringOrderInput["lines"] }) {
  // Lot 1, demande 1 : chaque moment est le matin ou le soir de la tournée du client.
  for (const slotId of input.slotIds ?? []) await findMerchantSlot(db, actor, slotId);
  if (input.lines) {
    assertLines(input.lines);
    const products = await db.product.findMany({
      where: { companyId: actor.companyId, id: { in: input.lines.map((line) => line.productId) } },
      select: { id: true, active: true, category: { select: { active: true } } },
    });
    const available = new Set(products.filter((product) => product.active && product.category.active).map((product) => product.id));
    if (input.lines.some((line) => !available.has(line.productId))) {
      throw new DomainRuleError(400, fr.order.errors.productUnavailable, "PRODUCT_UNAVAILABLE");
    }
  }
}

async function findOwn(db: RecurringDb, actor: MerchantRef, id: string) {
  const row = await db.recurringOrder.findFirst({ where: { id, companyId: actor.companyId, merchantId: actor.merchantId } });
  if (!row) throw new DomainRuleError(404, t.notFound, "RECURRING_NOT_FOUND");
  return row;
}

export async function listRecurringOrders(actor: MerchantRef, db: RecurringDb = prisma): Promise<PortalRecurringOrder[]> {
  const rows = await db.recurringOrder.findMany({
    where: { companyId: actor.companyId, merchantId: actor.merchantId },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      label: true,
      weekdays: true,
      active: true,
      slot: { select: { id: true, label: true, startTime: true, endTime: true, period: true } },
      lines: {
        select: {
          productId: true,
          quantity: true,
          product: { select: { name: true, unit: true, active: true, category: { select: { active: true } } } },
        },
      },
    },
  });
  const productIds = [...new Set(rows.flatMap((row) => row.lines.map((line) => line.productId)))];
  const prices = await loadAppliedPrices(db, actor.companyId, actor.merchantId, productIds);
  return rows.map((row) => {
    const lines = row.lines.map((line) => ({
      productId: line.productId,
      name: line.product.name,
      unit: line.product.unit,
      quantity: line.quantity,
      unitPriceCents: prices.get(line.productId)?.unitPriceCents ?? 0,
      available: line.product.active && line.product.category.active,
    }));
    const totals = computeTotals(lines.map((line) => ({ quantity: line.quantity, unitPriceCents: line.unitPriceCents, vatRateBasisPoints: 0 })));
    return {
      id: row.id,
      label: row.label,
      slot: { id: row.slot.id, label: clientSlotLabel(row.slot), startTime: row.slot.startTime, endTime: row.slot.endTime, period: row.slot.period ?? null },
      weekdays: row.weekdays,
      active: row.active,
      lines,
      subtotalCents: totals.subtotalCents,
    };
  });
}

/** CLI-09 : une commande type par moment choisi (matin, soir, ou les deux : deux commandes types). */
export async function createRecurringOrder(actor: MerchantRef, input: RecurringOrderInput, db: RecurringDb = prisma) {
  const weekdays = normalizeWeekdays(input.weekdays);
  const slotIds = requestedSlots(input);
  if (!slotIds) throw new DomainRuleError(400, fr.order.errors.slotUnavailable, "SLOT_UNAVAILABLE");
  await assertRefs(db, actor, { slotIds, lines: input.lines });
  return db.$transaction(async (tx) => {
    const ids: string[] = [];
    for (const slotId of slotIds) {
      const row = await tx.recurringOrder.create({
        data: {
          companyId: actor.companyId,
          merchantId: actor.merchantId,
          slotId,
          label: input.label ?? null,
          weekdays,
          active: input.active ?? true,
        },
      });
      await tx.recurringOrderLine.createMany({
        data: input.lines.map((line) => ({ companyId: actor.companyId, recurringOrderId: row.id, productId: line.productId, quantity: line.quantity })),
      });
      ids.push(row.id);
    }
    return { id: ids[0]!, ids };
  });
}

/**
 * Modifier, suspendre (`active: false`) ou réactiver. Les lignes fournies remplacent les anciennes.
 * Deux moments demandés (matin et soir) : cette commande type garde le sien (ou prend le premier) et
 * une copie est créée pour l'autre, avec les mêmes jours et les mêmes lignes.
 */
export async function updateRecurringOrder(actor: MerchantRef, id: string, input: UpdateRecurringOrderInput, db: RecurringDb = prisma) {
  const existing = await findOwn(db, actor, id);
  const weekdays = input.weekdays ? normalizeWeekdays(input.weekdays) : undefined;
  const slotIds = requestedSlots(input);
  await assertRefs(db, actor, { slotIds, lines: input.lines });
  const ownSlot = slotIds ? (slotIds.includes(existing.slotId) ? existing.slotId : slotIds[0]!) : undefined;
  const twinSlots = slotIds ? slotIds.filter((slotId) => slotId !== ownSlot) : [];
  return db.$transaction(async (tx) => {
    await tx.recurringOrder.update({
      where: { id: existing.id },
      data: {
        ...(input.label !== undefined ? { label: input.label } : {}),
        ...(ownSlot !== undefined ? { slotId: ownSlot } : {}),
        ...(weekdays ? { weekdays } : {}),
        ...(input.active !== undefined ? { active: input.active } : {}),
      },
    });
    if (input.lines) {
      await tx.recurringOrderLine.deleteMany({ where: { recurringOrderId: existing.id, companyId: actor.companyId } });
      await tx.recurringOrderLine.createMany({
        data: input.lines.map((line) => ({ companyId: actor.companyId, recurringOrderId: existing.id, productId: line.productId, quantity: line.quantity })),
      });
    }
    const ids = [existing.id];
    if (twinSlots.length > 0) {
      const lines = input.lines ?? (await tx.recurringOrderLine.findMany({ where: { recurringOrderId: existing.id, companyId: actor.companyId } }));
      for (const slotId of twinSlots) {
        const twin = await tx.recurringOrder.create({
          data: {
            companyId: actor.companyId,
            merchantId: actor.merchantId,
            slotId,
            label: input.label !== undefined ? input.label : existing.label,
            weekdays: weekdays ?? existing.weekdays,
            active: input.active ?? existing.active,
          },
        });
        await tx.recurringOrderLine.createMany({
          data: lines.map((line) => ({ companyId: actor.companyId, recurringOrderId: twin.id, productId: line.productId, quantity: line.quantity })),
        });
        ids.push(twin.id);
      }
    }
    return { id: existing.id, ids };
  });
}

export async function deleteRecurringOrder(actor: MerchantRef, id: string, db: RecurringDb = prisma) {
  const existing = await findOwn(db, actor, id);
  await db.recurringOrder.delete({ where: { id: existing.id } });
}
