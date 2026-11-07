/**
 * BOU-1 — espace boulanger (BOU-01 à BOU-06, RG-06, critère de recette 5).
 *
 * - Total à produire par produit, groupé par catégorie (BOU-01) : somme des quantités commandées des
 *   commandes verrouillées de la date (LOCKED, PREPARED, DELIVERED). Avant l'heure limite, total
 *   provisoire des commandes validées, clairement marqué : il peut encore changer.
 * - Bon de préparation par client (BOU-02) et regroupement par tournée dans l'ordre de chargement
 *   (BOU-03) : ordre inverse de livraison, le dernier arrêt au fond du véhicule.
 * - « Préparée » (BOU-05) : LOCKED → PREPARED ; la quantité livrée prend la quantité commandée
 *   quand aucun manquant n'a été signalé. Annulable (PREPARED → LOCKED) en cas d'erreur.
 * - Manquant (BOU-06) : `quantityDelivered` réduit, jamais au-dessus de la commande, journalisé et
 *   visible par l'administrateur ; la facture portera sur cette quantité (RG-06).
 * Le boulanger ne modifie ni les prix ni les commandes autrement (droits vérifiés par les routes).
 */
import type { OrderStatus, PrismaClient } from "@prisma/client";
import { prisma } from "@/services/prisma/client";
import { slotLabel } from "@/domains/order/merchant-order.service";
import { writeOrderAudit } from "@/domains/order/order-audit";
import { deliveryDateToDb } from "@/domains/order/order-deadline";
import type { DayLockState } from "@/domains/order/order-lock.service";
import type {
  LoadingRound,
  PreparationSheet,
  ProductionDay,
  ProductionTotalCategory,
} from "@/domains/production/production.types";
import { DomainRuleError } from "@/lib/errors/domain-rule-error";
import { fr } from "@/lib/i18n/fr";

export type ProductionDb = Pick<
  PrismaClient,
  "merchant" | "slot" | "product" | "category" | "order" | "orderLine" | "round" | "stop" | "auditLog" | "$transaction"
>;

export interface BakerActor {
  companyId: string;
  userId: string;
}

const t = fr.production;
/** Commandes verrouillées de la date : ce sont elles que l'on produit (critère 5). */
export const PRODUCTION_STATUSES: readonly OrderStatus[] = ["LOCKED", "PREPARED", "DELIVERED"];
/** Avant l'heure limite : commandes validées (total provisoire). */
const PROVISIONAL_STATUSES: readonly OrderStatus[] = ["VALIDATED", "LOCKED", "PREPARED"];
const BAKER_WRITABLE: readonly OrderStatus[] = ["LOCKED", "PREPARED"];

// ---------------------------------------------------------------------------
// Règle pure (critère 5)
// ---------------------------------------------------------------------------

/**
 * BOU-01, critère 5 : total à produire = somme des quantités commandées, par produit, groupé par
 * catégorie (ordre du catalogue). Les produits à zéro n'apparaissent pas.
 */
export function computeProductionTotals(
  lines: ReadonlyArray<{ productId: string; quantityOrdered: number }>,
  products: ReadonlyArray<{ id: string; name: string; unit: string; categoryId: string; sortOrder: number }>,
  categories: ReadonlyArray<{ id: string; name: string; sortOrder: number }>
): ProductionTotalCategory[] {
  const sums = new Map<string, number>();
  for (const line of lines) sums.set(line.productId, (sums.get(line.productId) ?? 0) + line.quantityOrdered);
  const productById = new Map(products.map((product) => [product.id, product]));
  const categoryById = new Map(categories.map((category) => [category.id, category]));
  const groups = new Map<string, ProductionTotalCategory & { sortOrder: number; productOrder: Map<string, number> }>();
  for (const [productId, quantity] of sums) {
    if (quantity <= 0) continue;
    const product = productById.get(productId);
    const category = product ? categoryById.get(product.categoryId) : undefined;
    const key = category?.id ?? "_other";
    const group =
      groups.get(key) ??
      {
        id: key,
        name: category?.name ?? t.otherCategory,
        sortOrder: category?.sortOrder ?? Number.MAX_SAFE_INTEGER,
        quantity: 0,
        products: [],
        productOrder: new Map<string, number>(),
      };
    group.quantity += quantity;
    group.products.push({ productId, name: product?.name ?? productId, unit: product?.unit ?? "", quantity });
    group.productOrder.set(productId, product?.sortOrder ?? 0);
    groups.set(key, group);
  }
  return [...groups.values()]
    .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, "fr"))
    .map((group) => ({
      id: group.id,
      name: group.name,
      quantity: group.quantity,
      products: group.products.sort(
        (a, b) => (group.productOrder.get(a.productId) ?? 0) - (group.productOrder.get(b.productId) ?? 0) || a.name.localeCompare(b.name, "fr")
      ),
    }));
}

// ---------------------------------------------------------------------------
// Lecture
// ---------------------------------------------------------------------------

export async function getProductionDay(companyId: string, day: DayLockState, db: ProductionDb = prisma): Promise<ProductionDay> {
  const deliveryDate = deliveryDateToDb(day.date);
  const statuses = day.closed ? PRODUCTION_STATUSES : PROVISIONAL_STATUSES;
  const orders = await db.order.findMany({
    where: { companyId, deliveryDate, status: { in: [...statuses] } },
    select: { id: true, reference: true, merchantId: true, slotId: true, status: true },
  });
  const orderIds = orders.map((order) => order.id);
  const lines = await db.orderLine.findMany({
    where: { companyId, orderId: { in: orderIds } },
    select: { id: true, orderId: true, productId: true, quantityOrdered: true, quantityDelivered: true },
  });
  const [products, categories] = await Promise.all([
    db.product.findMany({
      where: { companyId, id: { in: [...new Set(lines.map((line) => line.productId))] } },
      select: { id: true, name: true, unit: true, categoryId: true, sortOrder: true },
    }),
    db.category.findMany({ where: { companyId }, select: { id: true, name: true, sortOrder: true } }),
  ]);
  const totals = computeProductionTotals(lines, products, categories);
  const base = {
    date: day.date,
    cutoffAt: day.cutoffAt.toISOString(),
    closed: day.closed,
    provisional: !day.closed,
    orderCount: orders.length,
    itemCount: lines.reduce((sum, line) => sum + line.quantityOrdered, 0),
    totals,
  };
  // BOU-01 : bons et tournées seulement après l'heure limite.
  if (!day.closed) return { ...base, sheets: [], rounds: [] };

  const [merchants, slots, stops, rounds] = await Promise.all([
    db.merchant.findMany({
      where: { companyId, id: { in: [...new Set(orders.map((order) => order.merchantId))] } },
      select: { id: true, name: true, tradeName: true, address: true, postalCode: true, city: true, accessInstructions: true },
    }),
    db.slot.findMany({ where: { companyId }, select: { id: true, label: true, startTime: true, endTime: true } }),
    db.stop.findMany({ where: { companyId, orderId: { in: orderIds } }, select: { orderId: true, roundId: true, sequence: true } }),
    db.round.findMany({ where: { companyId, date: deliveryDate }, select: { id: true, name: true, slotId: true } }),
  ]);
  const roundStopCounts = new Map<string, number>();
  for (const round of rounds) roundStopCounts.set(round.id, 0);
  const allRoundStops = rounds.length
    ? await db.stop.findMany({ where: { companyId, roundId: { in: rounds.map((round) => round.id) } }, select: { roundId: true } })
    : [];
  for (const stop of allRoundStops) roundStopCounts.set(stop.roundId, (roundStopCounts.get(stop.roundId) ?? 0) + 1);

  const merchantById = new Map(merchants.map((merchant) => [merchant.id, merchant]));
  const slotById = new Map(slots.map((slot) => [slot.id, slot]));
  const stopByOrder = new Map(stops.map((stop) => [stop.orderId, stop]));
  const roundById = new Map(rounds.map((round) => [round.id, round]));
  const productById = new Map(products.map((product) => [product.id, product]));
  const categoryById = new Map(categories.map((category) => [category.id, category]));

  const sheets: PreparationSheet[] = orders.map((order) => {
    const merchant = merchantById.get(order.merchantId);
    const slot = slotById.get(order.slotId);
    const stop = stopByOrder.get(order.id);
    const round = stop ? roundById.get(stop.roundId) : undefined;
    const own = lines
      .filter((line) => line.orderId === order.id)
      .map((line) => {
        const product = productById.get(line.productId);
        const category = product ? categoryById.get(product.categoryId) : undefined;
        return {
          lineId: line.id,
          productId: line.productId,
          name: product?.name ?? "",
          unit: product?.unit ?? "",
          categoryName: category?.name ?? t.otherCategory,
          categoryOrder: category?.sortOrder ?? Number.MAX_SAFE_INTEGER,
          productOrder: product?.sortOrder ?? 0,
          quantityOrdered: line.quantityOrdered,
          quantityDelivered: line.quantityDelivered,
        };
      })
      .sort((a, b) => a.categoryOrder - b.categoryOrder || a.productOrder - b.productOrder || a.name.localeCompare(b.name, "fr"))
      .map((line) => ({
        lineId: line.lineId,
        productId: line.productId,
        name: line.name,
        unit: line.unit,
        categoryName: line.categoryName,
        quantityOrdered: line.quantityOrdered,
        quantityDelivered: line.quantityDelivered,
      }));
    return {
      orderId: order.id,
      reference: order.reference,
      status: order.status,
      prepared: order.status === "PREPARED" || order.status === "DELIVERED",
      merchant: {
        name: merchant ? merchant.tradeName || merchant.name : "",
        address: merchant?.address ?? "",
        postalCode: merchant?.postalCode ?? null,
        city: merchant?.city ?? null,
        accessInstructions: merchant?.accessInstructions ?? null,
      },
      slotLabel: slot ? slotLabel(slot) : "",
      round: round ? { id: round.id, name: round.name ?? "" } : null,
      stopSequence: stop?.sequence ?? null,
      stopCount: round ? roundStopCounts.get(round.id) ?? null : null,
      itemCount: own.reduce((sum, line) => sum + line.quantityOrdered, 0),
      shortage: own.some((line) => line.quantityDelivered !== null && line.quantityDelivered < line.quantityOrdered),
      lines: own,
    };
  });
  const slotStart = (sheet: PreparationSheet) => {
    const order = orders.find((row) => row.id === sheet.orderId);
    return slotById.get(order?.slotId ?? "")?.startTime ?? "";
  };
  sheets.sort(
    (a, b) =>
      slotStart(a).localeCompare(slotStart(b)) ||
      (a.round?.name ?? "~").localeCompare(b.round?.name ?? "~", "fr") ||
      (a.stopSequence ?? 9999) - (b.stopSequence ?? 9999) ||
      a.merchant.name.localeCompare(b.merchant.name, "fr")
  );

  // BOU-03 : ordre de chargement = ordre inverse de livraison.
  const loading: LoadingRound[] = rounds
    .map((round) => {
      const slot = slotById.get(round.slotId);
      return {
        id: round.id,
        name: round.name ?? "",
        slotLabel: slot ? slotLabel(slot) : "",
        start: slot?.startTime ?? "",
        orderIds: sheets
          .filter((sheet) => sheet.round?.id === round.id)
          .sort((a, b) => (b.stopSequence ?? 0) - (a.stopSequence ?? 0))
          .map((sheet) => sheet.orderId),
      };
    })
    .filter((round) => round.orderIds.length > 0)
    .sort((a, b) => a.start.localeCompare(b.start) || a.name.localeCompare(b.name, "fr"))
    .map((round) => ({ id: round.id, name: round.name, slotLabel: round.slotLabel, orderIds: round.orderIds }));
  const orphans = sheets.filter((sheet) => !sheet.round).map((sheet) => sheet.orderId);
  if (orphans.length > 0) loading.push({ id: null, name: t.noRound, slotLabel: "", orderIds: orphans });

  return { ...base, sheets, rounds: loading };
}

// ---------------------------------------------------------------------------
// Écritures du boulanger (BOU-05, BOU-06)
// ---------------------------------------------------------------------------

/** BOU-05 : coche ou décoche « préparée ». Sans effet si la commande est déjà dans l'état voulu. */
export async function setOrderPrepared(actor: BakerActor, orderId: string, prepared: boolean, now = new Date(), db: ProductionDb = prisma) {
  return db.$transaction(async (tx) => {
    const order = await tx.order.findFirst({ where: { id: orderId, companyId: actor.companyId } });
    if (!order) throw new DomainRuleError(404, t.errors.notFound, "ORDER_NOT_FOUND");
    if (!BAKER_WRITABLE.includes(order.status)) throw new DomainRuleError(409, t.errors.notLocked, "ORDER_NOT_LOCKED");
    const target: OrderStatus = prepared ? "PREPARED" : "LOCKED";
    if (order.status === target) return { orderId, status: target };
    const lines = await tx.orderLine.findMany({ where: { companyId: actor.companyId, orderId } });
    for (const line of lines) {
      // Préparée : la quantité livrée est la quantité commandée, sauf manquant déjà signalé.
      if (prepared && line.quantityDelivered === null) {
        await tx.orderLine.update({ where: { id: line.id }, data: { quantityDelivered: line.quantityOrdered } });
      }
      // Décochée : on revient à « non préparée », les manquants signalés restent.
      if (!prepared && line.quantityDelivered === line.quantityOrdered) {
        await tx.orderLine.update({ where: { id: line.id }, data: { quantityDelivered: null } });
      }
    }
    await tx.order.update({ where: { id: orderId }, data: { status: target, preparedAt: prepared ? now : null } });
    await writeOrderAudit(tx, {
      companyId: actor.companyId,
      actorId: actor.userId,
      orderId,
      action: prepared ? "PREPARED" : "UNPREPARED",
      before: { status: order.status },
      after: { status: target },
      at: now,
    });
    return { orderId, status: target };
  });
}

/**
 * BOU-06 : quantité réellement livrée d'une ligne (0 = manquant total), entre 0 et la quantité
 * commandée. Journalisé (avant / après) et visible par l'administrateur ; RG-06 pour la facture.
 */
export async function reportShortage(actor: BakerActor, lineId: string, quantityDelivered: number, now = new Date(), db: ProductionDb = prisma) {
  if (!Number.isInteger(quantityDelivered) || quantityDelivered < 0) {
    throw new DomainRuleError(400, t.errors.quantityAboveOrdered, "INVALID_QUANTITY");
  }
  return db.$transaction(async (tx) => {
    const line = await tx.orderLine.findFirst({ where: { id: lineId, companyId: actor.companyId } });
    if (!line) throw new DomainRuleError(404, t.errors.notFound, "LINE_NOT_FOUND");
    const order = await tx.order.findFirst({ where: { id: line.orderId, companyId: actor.companyId } });
    if (!order) throw new DomainRuleError(404, t.errors.notFound, "ORDER_NOT_FOUND");
    if (!BAKER_WRITABLE.includes(order.status)) throw new DomainRuleError(409, t.errors.notLocked, "ORDER_NOT_LOCKED");
    if (quantityDelivered > line.quantityOrdered) {
      throw new DomainRuleError(400, t.errors.quantityAboveOrdered, "QUANTITY_ABOVE_ORDERED");
    }
    const product = await tx.product.findFirst({ where: { id: line.productId, companyId: actor.companyId }, select: { name: true } });
    await tx.orderLine.update({ where: { id: line.id }, data: { quantityDelivered } });
    const name = product?.name ?? "";
    await writeOrderAudit(tx, {
      companyId: actor.companyId,
      actorId: actor.userId,
      orderId: order.id,
      action: "SHORTAGE",
      before: { lines: [{ productId: line.productId, name, quantityOrdered: line.quantityOrdered, quantityDelivered: line.quantityDelivered }] },
      after: { lines: [{ productId: line.productId, name, quantityOrdered: line.quantityOrdered, quantityDelivered }] },
      at: now,
    });
    return { lineId: line.id, orderId: order.id, quantityOrdered: line.quantityOrdered, quantityDelivered };
  });
}
