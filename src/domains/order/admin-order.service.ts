/**
 * LOCK-1 — back-office des commandes de l'administrateur (ADM-04, ADM-05, RG-10).
 *
 * - Liste des commandes d'un jour, filtrable par client et par tournée (ADM-04).
 * - Correction d'une commande, y compris après l'heure limite : quantités, ajout et retrait de ligne,
 *   annulation (ADM-05). Chaque correction écrit une ligne de journal (auteur, date, entité, action,
 *   avant / après), avant comme après l'heure limite ; `afterCutoff` le précise (RG-10).
 * - Une commande livrée ou annulée n'est plus corrigée ici (avoir : FACT-1).
 *
 * L'entreprise vient toujours de la session (PLA-01) : un identifiant d'une autre entreprise est
 * introuvable (404).
 */
import type { OrderStatus, PrismaClient } from "@prisma/client";
import { prisma } from "@/services/prisma/client";
import { computeTotals, loadAppliedPricesByMerchant } from "@/domains/catalog/pricing";
import { assertLines, slotLabel } from "@/domains/order/merchant-order.service";
import type {
  AdminOrderDay,
  AdminOrderDetail,
  AdminOrderHistoryEntry,
  AdminOrderLine,
  AdminOrderRow,
} from "@/domains/order/admin-order.types";
import {
  describeOrderAudit,
  ORDER_AUDIT_ENTITY,
  writeOrderAudit,
  type AuditLineSnapshot,
  type OrderAuditSnapshot,
} from "@/domains/order/order-audit";
import { deliveryDateKey, deliveryDateToDb, isOrderEditable, orderCutoffInstant } from "@/domains/order/order-deadline";
import type { DayLockState } from "@/domains/order/order-lock.service";
import { DomainRuleError } from "@/lib/errors/domain-rule-error";
import { fr } from "@/lib/i18n/fr";
import type { OrderLineInput } from "@/lib/validations/order";

export type AdminOrderDb = Pick<
  PrismaClient,
  | "company"
  | "merchant"
  | "slot"
  | "product"
  | "merchantPrice"
  | "order"
  | "orderLine"
  | "round"
  | "stop"
  | "auditLog"
  | "user"
  | "$transaction"
>;

export interface AdminActor {
  companyId: string;
  userId: string;
}

const t = fr.adminOrders.errors;
/** Statuts qui ne se corrigent plus ici. */
const FINAL_STATUSES: readonly OrderStatus[] = ["DELIVERED", "CANCELLED"];
/** Statuts dont les prix sont figés (RG-05) : une ligne ajoutée l'est aussitôt. */
const FROZEN_STATUSES: readonly OrderStatus[] = ["LOCKED", "PREPARED"];

/**
 * RG-10 : correction « après l'heure limite » — heure limite passée, ou commande déjà verrouillée
 * (verrouillage simulé en recette, ou date verrouillée en avance).
 */
function isAfterCutoff(order: { deliveryDate: Date; status: OrderStatus }, company: { cutoffTime: string; timezone: string }, now: Date) {
  return !isOrderEditable(order.deliveryDate, now, company.cutoffTime, company.timezone) || ["LOCKED", "PREPARED", "DELIVERED"].includes(order.status);
}

const personName = (user: { firstName: string; lastName: string } | undefined) =>
  user ? `${user.firstName} ${user.lastName}`.trim() : null;

// ---------------------------------------------------------------------------
// Liste du jour (ADM-04)
// ---------------------------------------------------------------------------

export async function listAdminOrders(
  companyId: string,
  day: DayLockState,
  filters: { merchantId?: string | null; roundId?: string | null },
  db: AdminOrderDb = prisma
): Promise<AdminOrderDay> {
  const deliveryDate = deliveryDateToDb(day.date);
  const orders = await db.order.findMany({
    where: { companyId, deliveryDate },
    select: { id: true, reference: true, merchantId: true, slotId: true, status: true, origin: true },
  });
  const orderIds = orders.map((order) => order.id);
  const [lines, merchants, slots, stops, rounds, audits] = await Promise.all([
    db.orderLine.findMany({
      where: { companyId, orderId: { in: orderIds } },
      select: { orderId: true, productId: true, quantityOrdered: true, quantityDelivered: true, unitPriceFrozenCents: true },
    }),
    db.merchant.findMany({ where: { companyId, id: { in: [...new Set(orders.map((order) => order.merchantId))] } }, select: { id: true, name: true, tradeName: true } }),
    db.slot.findMany({ where: { companyId }, select: { id: true, label: true, startTime: true, endTime: true } }),
    db.stop.findMany({ where: { companyId, orderId: { in: orderIds } }, select: { orderId: true, roundId: true, sequence: true } }),
    db.round.findMany({ where: { companyId, date: deliveryDate }, select: { id: true, name: true, slotId: true, status: true, driverId: true } }),
    db.auditLog.findMany({ where: { companyId, entityType: ORDER_AUDIT_ENTITY, entityId: { in: orderIds } }, select: { entityId: true, action: true } }),
  ]);
  const drivers = await db.user.findMany({
    where: { companyId, id: { in: rounds.map((round) => round.driverId).filter((id): id is string => Boolean(id)) } },
    select: { id: true, firstName: true, lastName: true },
  });
  const prices = await loadAppliedPricesByMerchant(
    db,
    companyId,
    [...new Set(orders.map((order) => order.merchantId))],
    [...new Set(lines.map((line) => line.productId))]
  );
  const merchantName = new Map(merchants.map((merchant) => [merchant.id, merchant.tradeName || merchant.name]));
  const slotById = new Map(slots.map((slot) => [slot.id, slot]));
  const stopByOrder = new Map(stops.map((stop) => [stop.orderId, stop]));
  const roundById = new Map(rounds.map((round) => [round.id, round]));
  const driverName = new Map(drivers.map((driver) => [driver.id, personName(driver)]));
  const corrected = new Set(audits.filter((audit) => audit.action.startsWith("ADMIN_")).map((audit) => audit.entityId));

  const all: AdminOrderRow[] = orders.map((order) => {
    const own = lines.filter((line) => line.orderId === order.id);
    const merchantPrices = prices.get(order.merchantId);
    const totals = computeTotals(
      own.map((line) => ({
        quantity: line.quantityOrdered,
        unitPriceCents: line.unitPriceFrozenCents ?? merchantPrices?.get(line.productId)?.unitPriceCents ?? 0,
        vatRateBasisPoints: merchantPrices?.get(line.productId)?.vatRateBasisPoints ?? 0,
      }))
    );
    const slot = slotById.get(order.slotId);
    const stop = stopByOrder.get(order.id);
    const round = stop ? roundById.get(stop.roundId) : undefined;
    return {
      id: order.id,
      reference: order.reference,
      merchant: { id: order.merchantId, name: merchantName.get(order.merchantId) ?? "" },
      slot: { id: order.slotId, label: slot ? slotLabel(slot) : "", startTime: slot?.startTime ?? "" },
      status: order.status,
      origin: order.origin,
      round: round ? { id: round.id, name: round.name ?? "" } : null,
      stopSequence: stop?.sequence ?? null,
      lineCount: own.length,
      itemCount: totals.itemCount,
      subtotalCents: totals.subtotalCents,
      shortage: own.some((line) => line.quantityDelivered !== null && line.quantityDelivered < line.quantityOrdered),
      corrected: corrected.has(order.id),
    };
  });
  all.sort(
    (a, b) =>
      a.slot.startTime.localeCompare(b.slot.startTime) ||
      (a.round?.name ?? "~").localeCompare(b.round?.name ?? "~", "fr") ||
      (a.stopSequence ?? 9999) - (b.stopSequence ?? 9999) ||
      a.merchant.name.localeCompare(b.merchant.name, "fr")
  );

  const filtered = all.filter(
    (row) =>
      (!filters.merchantId || row.merchant.id === filters.merchantId) &&
      (!filters.roundId || (filters.roundId === "none" ? row.round === null : row.round?.id === filters.roundId))
  );
  return {
    date: day.date,
    cutoffAt: day.cutoffAt.toISOString(),
    closed: day.closed,
    lockedAt: day.lockedAt?.toISOString() ?? null,
    merchants: [...new Map(all.map((row) => [row.merchant.id, row.merchant])).values()].sort((a, b) => a.name.localeCompare(b.name, "fr")),
    rounds: rounds
      .map((round) => ({ id: round.id, name: round.name ?? "", status: round.status, driverName: round.driverId ? driverName.get(round.driverId) ?? null : null }))
      .sort((a, b) => a.name.localeCompare(b.name, "fr")),
    orders: filtered,
    total: all.length,
  };
}

// ---------------------------------------------------------------------------
// Détail et journal
// ---------------------------------------------------------------------------

async function findOrder(db: Pick<AdminOrderDb, "order">, companyId: string, orderId: string) {
  const order = await db.order.findFirst({ where: { id: orderId, companyId } });
  if (!order) throw new DomainRuleError(404, t.notFound, "ORDER_NOT_FOUND");
  return order;
}

async function loadHistory(db: AdminOrderDb, companyId: string, orderId: string): Promise<AdminOrderHistoryEntry[]> {
  const rows = await db.auditLog.findMany({
    where: { companyId, entityType: ORDER_AUDIT_ENTITY, entityId: orderId },
    select: { id: true, actorId: true, action: true, before: true, after: true, createdAt: true },
  });
  const actors = await db.user.findMany({
    where: { companyId, id: { in: [...new Set(rows.map((row) => row.actorId).filter((id): id is string => Boolean(id)))] } },
    select: { id: true, firstName: true, lastName: true },
  });
  const names = new Map(actors.map((actor) => [actor.id, personName(actor)]));
  return rows
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .map((row) => ({
      id: row.id,
      at: row.createdAt.toISOString(),
      actorName: (row.actorId && names.get(row.actorId)) || fr.orderHistory.system,
      action: row.action,
      afterCutoff: Boolean((row.after as OrderAuditSnapshot | null)?.afterCutoff),
      changes: describeOrderAudit(row.action, row.before, row.after),
    }));
}

export async function getAdminOrder(companyId: string, orderId: string, now = new Date(), db: AdminOrderDb = prisma): Promise<AdminOrderDetail> {
  const order = await findOrder(db, companyId, orderId);
  const company = await db.company.findUnique({ where: { id: companyId }, select: { cutoffTime: true, timezone: true } });
  if (!company) throw new DomainRuleError(404, t.notFound, "ORDER_NOT_FOUND");
  const [lineRows, merchant, slot, stop] = await Promise.all([
    db.orderLine.findMany({ where: { companyId, orderId } }),
    db.merchant.findFirst({ where: { id: order.merchantId, companyId }, select: { id: true, name: true, tradeName: true, address: true, city: true } }),
    db.slot.findFirst({ where: { id: order.slotId, companyId }, select: { id: true, label: true, startTime: true, endTime: true } }),
    db.stop.findFirst({ where: { companyId, orderId }, select: { roundId: true, sequence: true } }),
  ]);
  const round = stop ? await db.round.findFirst({ where: { id: stop.roundId, companyId }, select: { id: true, name: true, status: true, driverId: true } }) : null;
  const driver = round?.driverId ? await db.user.findFirst({ where: { id: round.driverId, companyId }, select: { firstName: true, lastName: true } }) : null;
  const productIds = lineRows.map((line) => line.productId);
  const [products, prices, history] = await Promise.all([
    db.product.findMany({ where: { companyId, id: { in: productIds } }, select: { id: true, name: true, unit: true, sortOrder: true } }),
    loadAppliedPricesByMerchant(db, companyId, [order.merchantId], productIds),
    loadHistory(db, companyId, orderId),
  ]);
  const productById = new Map(products.map((product) => [product.id, product]));
  const applied = prices.get(order.merchantId);
  const lines: AdminOrderLine[] = lineRows
    .map((line) => {
      const product = productById.get(line.productId);
      const price = applied?.get(line.productId);
      return {
        id: line.id,
        productId: line.productId,
        name: product?.name ?? "",
        unit: product?.unit ?? "",
        quantityOrdered: line.quantityOrdered,
        quantityDelivered: line.quantityDelivered,
        unitPriceCents: line.unitPriceFrozenCents ?? price?.unitPriceCents ?? 0,
        frozen: line.unitPriceFrozenCents !== null,
        vatRateBasisPoints: price?.vatRateBasisPoints ?? 0,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name, "fr"));
  const ordered = computeTotals(lines.map((line) => ({ quantity: line.quantityOrdered, unitPriceCents: line.unitPriceCents, vatRateBasisPoints: line.vatRateBasisPoints })));
  const delivered = computeTotals(
    lines.map((line) => ({ quantity: line.quantityDelivered ?? line.quantityOrdered, unitPriceCents: line.unitPriceCents, vatRateBasisPoints: line.vatRateBasisPoints }))
  );
  const cutoffAt = orderCutoffInstant(order.deliveryDate, company.cutoffTime, company.timezone);
  return {
    id: order.id,
    reference: order.reference,
    deliveryDate: deliveryDateKey(order.deliveryDate),
    cutoffAt: cutoffAt.toISOString(),
    afterCutoff: isAfterCutoff(order, company, now),
    status: order.status,
    origin: order.origin,
    notes: order.notes,
    editable: !FINAL_STATUSES.includes(order.status),
    merchant: { id: order.merchantId, name: merchant ? merchant.tradeName || merchant.name : "", address: merchant?.address ?? "", city: merchant?.city ?? null },
    slot: { id: order.slotId, label: slot ? slotLabel(slot) : "" },
    round: round ? { id: round.id, name: round.name ?? "", status: round.status, driverName: personName(driver ?? undefined) } : null,
    stopSequence: stop?.sequence ?? null,
    lockedAt: order.lockedAt?.toISOString() ?? null,
    preparedAt: order.preparedAt?.toISOString() ?? null,
    lines,
    subtotalCents: ordered.subtotalCents,
    deliveredSubtotalCents: delivered.subtotalCents,
    history,
  };
}

// ---------------------------------------------------------------------------
// Corrections (ADM-05, RG-10)
// ---------------------------------------------------------------------------

function snapshot(lines: ReadonlyArray<{ productId: string; quantityOrdered: number; quantityDelivered: number | null }>, names: Map<string, string>): AuditLineSnapshot[] {
  return lines
    .map((line) => ({ productId: line.productId, name: names.get(line.productId) ?? "", quantityOrdered: line.quantityOrdered, quantityDelivered: line.quantityDelivered }))
    .sort((a, b) => a.name.localeCompare(b.name, "fr"));
}

/**
 * Nouvelle quantité livrée d'une ligne corrigée : vide si pas encore préparée ; sinon la nouvelle
 * quantité, ou le manquant déjà signalé s'il est plus petit (jamais au-dessus de la commande).
 */
export function correctedDelivered(previous: { quantityOrdered: number; quantityDelivered: number | null }, quantity: number): number | null {
  if (previous.quantityDelivered === null) return null;
  if (previous.quantityDelivered >= previous.quantityOrdered) return quantity;
  return Math.min(previous.quantityDelivered, quantity);
}

export async function correctAdminOrder(
  actor: AdminActor,
  orderId: string,
  input: { lines: OrderLineInput[]; note?: string | null },
  now = new Date(),
  db: AdminOrderDb = prisma
) {
  assertLines(input.lines);
  const company = await db.company.findUnique({ where: { id: actor.companyId }, select: { cutoffTime: true, timezone: true } });
  if (!company) throw new DomainRuleError(404, t.notFound, "ORDER_NOT_FOUND");

  await db.$transaction(async (tx) => {
    const order = await findOrder(tx, actor.companyId, orderId);
    if (FINAL_STATUSES.includes(order.status)) throw new DomainRuleError(409, t.notEditable, "ORDER_NOT_EDITABLE");
    const existing = await tx.orderLine.findMany({ where: { companyId: actor.companyId, orderId } });
    const byProduct = new Map(existing.map((line) => [line.productId, line]));
    const productIds = [...new Set([...existing.map((line) => line.productId), ...input.lines.map((line) => line.productId)])];
    const products = await tx.product.findMany({
      where: { companyId: actor.companyId, id: { in: productIds } },
      select: { id: true, name: true, active: true, category: { select: { active: true } } },
    });
    const productById = new Map(products.map((product) => [product.id, product]));
    const names = new Map(products.map((product) => [product.id, product.name]));
    // Un produit ajouté doit être proposé au catalogue de l'entreprise (PLA-01).
    for (const line of input.lines) {
      const product = productById.get(line.productId);
      if (!byProduct.has(line.productId) && !(product?.active && product.category.active)) {
        throw new DomainRuleError(400, t.productUnavailable, "PRODUCT_UNAVAILABLE", { productId: line.productId });
      }
    }

    const wanted = new Map(input.lines.map((line) => [line.productId, line.quantity]));
    const unchanged =
      existing.length === input.lines.length && existing.every((line) => wanted.get(line.productId) === line.quantityOrdered);
    if (unchanged && !input.note) throw new DomainRuleError(400, t.noChange, "NO_CHANGE");

    const frozen = FROZEN_STATUSES.includes(order.status);
    const added = input.lines.filter((line) => !byProduct.has(line.productId));
    const prices = frozen && added.length > 0
      ? (await loadAppliedPricesByMerchant(tx, actor.companyId, [order.merchantId], added.map((line) => line.productId))).get(order.merchantId)
      : undefined;
    const removedIds = existing.filter((line) => !wanted.has(line.productId)).map((line) => line.id);
    if (removedIds.length > 0) await tx.orderLine.deleteMany({ where: { companyId: actor.companyId, id: { in: removedIds } } });
    const afterLines: Array<{ productId: string; quantityOrdered: number; quantityDelivered: number | null }> = [];
    for (const line of input.lines) {
      const previous = byProduct.get(line.productId);
      if (previous) {
        const quantityDelivered = correctedDelivered(previous, line.quantity);
        if (previous.quantityOrdered !== line.quantity || previous.quantityDelivered !== quantityDelivered) {
          await tx.orderLine.update({ where: { id: previous.id }, data: { quantityOrdered: line.quantity, quantityDelivered } });
        }
        afterLines.push({ productId: line.productId, quantityOrdered: line.quantity, quantityDelivered });
      } else {
        const quantityDelivered = order.status === "PREPARED" ? line.quantity : null;
        await tx.orderLine.create({
          data: {
            companyId: actor.companyId,
            orderId,
            productId: line.productId,
            quantityOrdered: line.quantity,
            quantityDelivered,
            unitPriceFrozenCents: frozen ? prices?.get(line.productId)?.unitPriceCents ?? null : null,
          },
        });
        afterLines.push({ productId: line.productId, quantityOrdered: line.quantity, quantityDelivered });
      }
    }
    await writeOrderAudit(tx, {
      companyId: actor.companyId,
      actorId: actor.userId,
      orderId,
      action: "ADMIN_CORRECTION",
      before: { status: order.status, lines: snapshot(existing, names) },
      after: {
        status: order.status,
        lines: snapshot(afterLines, names),
        afterCutoff: isAfterCutoff(order, company, now),
        note: input.note ?? null,
      },
      at: now,
    });
  }, { maxWait: 10_000, timeout: 30_000 });
  return getAdminOrder(actor.companyId, orderId, now, db);
}

/**
 * ADM-05 : annulation par l'administrateur. La commande quitte sa tournée (arrêt non livré retiré,
 * arrêts suivants renumérotés) ; elle n'est ni produite ni livrée. Journalisée.
 */
export async function cancelAdminOrder(
  actor: AdminActor,
  orderId: string,
  input: { note?: string | null },
  now = new Date(),
  db: AdminOrderDb = prisma
) {
  const company = await db.company.findUnique({ where: { id: actor.companyId }, select: { cutoffTime: true, timezone: true } });
  if (!company) throw new DomainRuleError(404, t.notFound, "ORDER_NOT_FOUND");
  await db.$transaction(async (tx) => {
    const order = await findOrder(tx, actor.companyId, orderId);
    if (FINAL_STATUSES.includes(order.status)) throw new DomainRuleError(409, t.notEditable, "ORDER_NOT_EDITABLE");
    const lines = await tx.orderLine.findMany({ where: { companyId: actor.companyId, orderId } });
    const products = await tx.product.findMany({ where: { companyId: actor.companyId, id: { in: lines.map((line) => line.productId) } }, select: { id: true, name: true } });
    await tx.order.update({ where: { id: order.id }, data: { status: "CANCELLED", cancelledAt: now } });
    const stop = await tx.stop.findFirst({ where: { companyId: actor.companyId, orderId } });
    if (stop && stop.status !== "DELIVERED") {
      await tx.stop.delete({ where: { id: stop.id } });
      const rest = (await tx.stop.findMany({ where: { companyId: actor.companyId, roundId: stop.roundId } })).sort((a, b) => a.sequence - b.sequence);
      for (const [index, other] of rest.entries()) {
        if (other.sequence !== index + 1) await tx.stop.update({ where: { id: other.id }, data: { sequence: index + 1 } });
      }
    }
    const names = new Map(products.map((product) => [product.id, product.name]));
    await writeOrderAudit(tx, {
      companyId: actor.companyId,
      actorId: actor.userId,
      orderId,
      action: "ADMIN_CANCEL",
      before: { status: order.status, lines: snapshot(lines, names) },
      after: {
        status: "CANCELLED",
        afterCutoff: isAfterCutoff(order, company, now),
        note: input.note ?? null,
      },
      at: now,
    });
  }, { maxWait: 10_000, timeout: 30_000 });
  return getAdminOrder(actor.companyId, orderId, now, db);
}
