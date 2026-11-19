/**
 * Lot 2, demandes 6, 7 et 8 — réception du matin, clôture du soir et stock des boutiques.
 *
 * - Réception (demande 6) : la tablette liste l'envoi du jour (quantités prévues) ; la vendeuse note pour chaque
 *   produit la quantité reçue et la quantité abîmée pendant la livraison. Le reçu en bon état devient un lot de
 *   stock daté (dernier jour de vente = réception + durée de vente − 1). Un écart avec l'envoi déclenche une
 *   alerte dans la cloche de l'administrateur et du pâtissier (pâtisserie) ou du boulanger (pain).
 * - Clôture (demande 7) : `stock-rules.ts` (vendus calculés, plus anciens en premier, fin de vente, abîmés).
 * - Stock (demande 8) : par boutique et par produit, stock actuel, à jeter ce soir, et les chiffres d'un jour
 *   (reçus, abîmés à la livraison, vendus, jetés), la veille par défaut.
 *
 * Tout est borné à l'entreprise de la session ; la vendeuse ne touche qu'à sa boutique (vérifié par la route).
 */
import type { PrismaClient, ProductFamily } from "@prisma/client";
import { prisma } from "@/services/prisma/client";
import { DomainRuleError } from "@/lib/errors/domain-rule-error";
import { companyToday, deliveryDateKey, deliveryDateToDb, toCalendarDate } from "@/domains/order/order-deadline";
import { StockRuleError, addDays, expiringOn, lastSaleDayOf, planClose, type StockLot } from "@/domains/shop/stock-rules";

export type ShopStockDb = Pick<
  PrismaClient,
  "company" | "merchant" | "order" | "orderLine" | "product" | "category" | "shopStockLot" | "shopDayClose" | "user" | "role" | "clientNotification" | "auditLog" | "$transaction"
>;
const defaultDb = () => prisma as unknown as ShopStockDb;

export interface SellerActor {
  companyId: string;
  userId: string;
  shopId: string;
}

const dayKey = (value: Date) => deliveryDateKey(value);

function assertDate(date: string) {
  if (!toCalendarDate(date)) throw new DomainRuleError(400, "Date invalide.", "INVALID_DATE");
}

async function today(db: ShopStockDb, companyId: string, now: Date) {
  const company = await db.company.findUnique({ where: { id: companyId }, select: { timezone: true } });
  if (!company) throw new DomainRuleError(404, "Entreprise introuvable.", "COMPANY_NOT_FOUND");
  return companyToday(now, company.timezone);
}

async function assertShop(db: ShopStockDb, companyId: string, shopId: string) {
  const shop = await db.merchant.findFirst({ where: { id: shopId, companyId, kind: "SHOP" }, select: { id: true, name: true } });
  if (!shop) throw new DomainRuleError(404, "Boutique introuvable.", "SHOP_NOT_FOUND");
  return shop;
}

async function productInfo(db: ShopStockDb, companyId: string, productIds: readonly string[]) {
  if (productIds.length === 0) return new Map<string, { name: string; unit: string; shelfLifeDays: number; family: ProductFamily; categoryName: string }>();
  const [products, categories] = await Promise.all([
    db.product.findMany({ where: { companyId, id: { in: [...productIds] } }, select: { id: true, name: true, unit: true, shelfLifeDays: true, categoryId: true } }),
    db.category.findMany({ where: { companyId }, select: { id: true, name: true, family: true } }),
  ]);
  const categoryById = new Map(categories.map((category) => [category.id, category]));
  return new Map(
    products.map((product) => {
      const category = categoryById.get(product.categoryId);
      return [product.id, { name: product.name, unit: product.unit, shelfLifeDays: product.shelfLifeDays ?? 1, family: category?.family ?? "BREAD", categoryName: category?.name ?? "" }];
    })
  );
}

// ---------------------------------------------------------------------------
// Demande 6 : réception du matin
// ---------------------------------------------------------------------------

export interface ReceptionLine {
  productId: string;
  name: string;
  unit: string;
  sent: number;
  received: number | null;
  damaged: number | null;
}

export interface ReceptionSheet {
  date: string;
  shopName: string;
  orderId: string | null;
  receivedAt: string | null;
  lines: ReceptionLine[];
}

async function shipmentOf(db: ShopStockDb, companyId: string, shopId: string, date: string) {
  return db.order.findFirst({
    where: { companyId, merchantId: shopId, deliveryDate: deliveryDateToDb(date), origin: "SHIPMENT", status: { not: "CANCELLED" } },
    select: { id: true, receivedAt: true },
  });
}

/** Envoi du jour de la boutique, avec les quantités prévues (et notées si la réception est faite). */
export async function getReception(actor: Pick<SellerActor, "companyId" | "shopId">, date: string, db: ShopStockDb = defaultDb()): Promise<ReceptionSheet> {
  assertDate(date);
  const shop = await assertShop(db, actor.companyId, actor.shopId);
  const order = await shipmentOf(db, actor.companyId, shop.id, date);
  if (!order) return { date, shopName: shop.name, orderId: null, receivedAt: null, lines: [] };
  const lines = await db.orderLine.findMany({
    where: { companyId: actor.companyId, orderId: order.id },
    select: { productId: true, quantityOrdered: true, quantityReceived: true, quantityDamaged: true },
  });
  const info = await productInfo(db, actor.companyId, lines.map((line) => line.productId));
  return {
    date,
    shopName: shop.name,
    orderId: order.id,
    receivedAt: order.receivedAt ? order.receivedAt.toISOString() : null,
    lines: lines
      .map((line) => ({
        productId: line.productId,
        name: info.get(line.productId)?.name ?? "",
        unit: info.get(line.productId)?.unit ?? "",
        sent: line.quantityOrdered,
        received: line.quantityReceived,
        damaged: line.quantityDamaged,
      }))
      .sort((a, b) => a.name.localeCompare(b.name, "fr")),
  };
}

export interface ReceiveInput {
  date: string;
  lines: ReadonlyArray<{ productId: string; received: number; damaged: number }>;
}

/**
 * Demande 6 : la vendeuse note la réception. Le bon état (reçu − abîmé) entre en stock ; un écart avec l'envoi
 * alerte l'administrateur et le pâtissier (ou le boulanger). Une réception se note une fois.
 */
export async function receiveShipment(actor: SellerActor, input: ReceiveInput, deps: { db?: ShopStockDb; now?: Date } = {}) {
  const db = deps.db ?? defaultDb();
  const now = deps.now ?? new Date();
  assertDate(input.date);
  if (input.date > (await today(db, actor.companyId, now))) throw new DomainRuleError(400, "La livraison de ce jour n'est pas encore arrivée.", "DATE_IN_FUTURE");
  const shop = await assertShop(db, actor.companyId, actor.shopId);
  const order = await shipmentOf(db, actor.companyId, shop.id, input.date);
  if (!order) throw new DomainRuleError(404, "Aucun envoi prévu pour ce jour.", "NO_SHIPMENT");
  if (order.receivedAt) throw new DomainRuleError(409, "La réception de cet envoi est déjà notée.", "ALREADY_RECEIVED");
  const lines = await db.orderLine.findMany({ where: { companyId: actor.companyId, orderId: order.id }, select: { id: true, productId: true, quantityOrdered: true } });
  const noted = new Map(input.lines.map((line) => [line.productId, line]));
  for (const line of input.lines) {
    if (!lines.some((row) => row.productId === line.productId)) throw new DomainRuleError(400, "Ce produit n'était pas dans l'envoi.", "PRODUCT_NOT_SENT", { productId: line.productId });
    if (!Number.isInteger(line.received) || line.received < 0 || !Number.isInteger(line.damaged) || line.damaged < 0 || line.damaged > line.received) {
      throw new DomainRuleError(400, "Les produits abîmés font partie des produits reçus.", "RECEPTION_INVALID", { productId: line.productId });
    }
  }
  if (lines.some((line) => !noted.has(line.productId))) throw new DomainRuleError(400, "Notez chaque produit de l'envoi (0 s'il n'est pas arrivé).", "RECEPTION_INCOMPLETE");
  const info = await productInfo(db, actor.companyId, lines.map((line) => line.productId));
  const gaps: Array<{ name: string; sent: number; received: number; family: ProductFamily }> = [];
  await db.$transaction(async (tx) => {
    for (const line of lines) {
      const note = noted.get(line.productId)!;
      await tx.orderLine.update({ where: { id: line.id }, data: { quantityReceived: note.received, quantityDamaged: note.damaged } });
      const good = note.received - note.damaged;
      if (good > 0) {
        await tx.shopStockLot.create({
          data: {
            companyId: actor.companyId,
            shopId: shop.id,
            productId: line.productId,
            receivedOn: deliveryDateToDb(input.date),
            lastSaleDay: deliveryDateToDb(lastSaleDayOf(input.date, info.get(line.productId)?.shelfLifeDays ?? 1)),
            initialQuantity: good,
            quantity: good,
          },
        });
      }
      if (note.received !== line.quantityOrdered) {
        gaps.push({ name: info.get(line.productId)?.name ?? "", sent: line.quantityOrdered, received: note.received, family: info.get(line.productId)?.family ?? "BREAD" });
      }
    }
    await tx.order.update({ where: { id: order.id }, data: { receivedAt: now } });
    await tx.auditLog.create({
      data: {
        companyId: actor.companyId,
        actorId: actor.userId,
        entityType: "ShopReception",
        entityId: order.id,
        action: "RECEIVE",
        after: { date: input.date, shopId: shop.id, lines: input.lines.map((line) => ({ ...line })) },
      },
    });
    // Vérification 2 : écart avec l'envoi → alerte dans la cloche (administrateurs, pâtissiers et/ou boulangers).
    if (gaps.length) {
      const families = new Set(gaps.map((gap) => gap.family));
      const roles = ["ADMIN", ...(families.has("PASTRY") ? ["PASTRY_CHEF"] : []), ...(families.has("BREAD") ? ["BAKER"] : [])];
      const roleIds = (await tx.role.findMany({ where: { systemRole: { in: roles as Array<"ADMIN" | "PASTRY_CHEF" | "BAKER"> } }, select: { id: true } })).map((role) => role.id);
      const recipients = await tx.user.findMany({ where: { companyId: actor.companyId, status: "ACTIVE", roleId: { in: roleIds } }, select: { id: true } });
      const body = gaps.map((gap) => `${gap.name} : ${gap.received} reçu(s) sur ${gap.sent} envoyé(s)`).join(" ; ");
      for (const user of recipients) {
        await tx.clientNotification.create({
          data: { companyId: actor.companyId, userId: user.id, type: "SHOP_RECEPTION_GAP", title: `Écart à la réception · ${shop.name}`, body, href: null },
        });
      }
    }
  });
  return { gaps: gaps.map(({ name, sent, received }) => ({ name, sent, received })), sheet: await getReception(actor, input.date, db) };
}

// ---------------------------------------------------------------------------
// Demande 7 : clôture du soir
// ---------------------------------------------------------------------------

async function lotsOf(db: ShopStockDb, companyId: string, shopId: string, upTo: string) {
  const rows = await db.shopStockLot.findMany({
    where: { companyId, shopId, receivedOn: { lte: deliveryDateToDb(upTo) } },
    select: { id: true, productId: true, receivedOn: true, lastSaleDay: true, quantity: true },
  });
  const byProduct = new Map<string, StockLot[]>();
  for (const row of rows) {
    const list = byProduct.get(row.productId) ?? [];
    list.push({ id: row.id, receivedOn: dayKey(row.receivedOn), lastSaleDay: dayKey(row.lastSaleDay), quantity: row.quantity });
    byProduct.set(row.productId, list);
  }
  return byProduct;
}

export interface CloseSheetLine {
  productId: string;
  name: string;
  unit: string;
  family: ProductFamily;
  lots: StockLot[];
  /** Déjà clôturé ce jour-là : les chiffres enregistrés. */
  closed: null | { remaining: number; sold: number; discardedExpired: number; discardedDamaged: number };
}

export interface CloseSheet {
  date: string;
  shopName: string;
  closed: boolean;
  lines: CloseSheetLine[];
}

/** Produits à compter le soir : tout ce qui a du stock ce jour-là (ou en avait, si la clôture est faite). */
export async function getCloseSheet(actor: Pick<SellerActor, "companyId" | "shopId">, date: string, db: ShopStockDb = defaultDb()): Promise<CloseSheet> {
  assertDate(date);
  const shop = await assertShop(db, actor.companyId, actor.shopId);
  const [lots, closes] = await Promise.all([
    lotsOf(db, actor.companyId, shop.id, date),
    db.shopDayClose.findMany({ where: { companyId: actor.companyId, shopId: shop.id, date: deliveryDateToDb(date) } }),
  ]);
  const productIds = [...new Set([...[...lots].filter(([, list]) => list.some((lot) => lot.quantity > 0)).map(([id]) => id), ...closes.map((close) => close.productId)])];
  const info = await productInfo(db, actor.companyId, productIds);
  return {
    date,
    shopName: shop.name,
    closed: closes.length > 0,
    lines: productIds
      .map((productId) => {
        const close = closes.find((row) => row.productId === productId);
        return {
          productId,
          name: info.get(productId)?.name ?? "",
          unit: info.get(productId)?.unit ?? "",
          family: info.get(productId)?.family ?? ("BREAD" as const),
          lots: (lots.get(productId) ?? []).filter((lot) => lot.quantity > 0),
          closed: close ? { remaining: close.remaining, sold: close.sold, discardedExpired: close.discardedExpired, discardedDamaged: close.discardedDamaged } : null,
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name, "fr")),
  };
}

export interface CloseInput {
  date: string;
  entries: ReadonlyArray<{ productId: string; remaining: number; damaged: number; discardExpired?: number | null }>;
}

/**
 * Demande 7 : la vendeuse note le reste de chaque produit, les abîmés en boutique, et confirme les produits en fin
 * de vente jetés. Ventes calculées, lots mis à jour, journée enregistrée (une clôture par jour).
 */
export async function closeDay(actor: SellerActor, input: CloseInput, deps: { db?: ShopStockDb; now?: Date } = {}) {
  const db = deps.db ?? defaultDb();
  const now = deps.now ?? new Date();
  assertDate(input.date);
  if (input.date > (await today(db, actor.companyId, now))) throw new DomainRuleError(400, "On ne clôture pas un jour à venir.", "DATE_IN_FUTURE");
  const sheet = await getCloseSheet(actor, input.date, db);
  if (sheet.closed) throw new DomainRuleError(409, "La journée est déjà clôturée.", "ALREADY_CLOSED");
  const entries = new Map(input.entries.map((entry) => [entry.productId, entry]));
  if (sheet.lines.some((line) => !entries.has(line.productId))) throw new DomainRuleError(400, "Notez le reste de chaque produit (0 s'il n'en reste pas).", "CLOSE_INCOMPLETE");
  for (const productId of entries.keys()) {
    if (!sheet.lines.some((line) => line.productId === productId)) throw new DomainRuleError(400, "Ce produit n'est pas en stock dans la boutique.", "PRODUCT_NOT_IN_STOCK", { productId });
  }
  const receptions = await db.order.findFirst({
    where: { companyId: actor.companyId, merchantId: actor.shopId, deliveryDate: deliveryDateToDb(input.date), origin: "SHIPMENT" },
    select: { id: true },
  });
  const damagedOnDelivery = receptions
    ? new Map(
        (await db.orderLine.findMany({ where: { companyId: actor.companyId, orderId: receptions.id }, select: { productId: true, quantityDamaged: true } })).map((line) => [
          line.productId,
          line.quantityDamaged ?? 0,
        ])
      )
    : new Map<string, number>();
  const plans = sheet.lines.map((line) => {
    const entry = entries.get(line.productId)!;
    try {
      return { line, plan: planClose(input.date, line.lots, { remaining: entry.remaining, damaged: entry.damaged, discardExpired: entry.discardExpired }) };
    } catch (error) {
      if (error instanceof StockRuleError) throw new DomainRuleError(400, `${line.name} : ${error.message}`, error.code, { productId: line.productId });
      throw error;
    }
  });
  await db.$transaction(async (tx) => {
    for (const { line, plan } of plans) {
      for (const lot of line.lots) {
        const after = plan.lotsAfter.get(lot.id) ?? lot.quantity;
        if (after !== lot.quantity) await tx.shopStockLot.update({ where: { id: lot.id }, data: { quantity: after } });
      }
      await tx.shopDayClose.create({
        data: {
          companyId: actor.companyId,
          shopId: actor.shopId,
          productId: line.productId,
          date: deliveryDateToDb(input.date),
          morningStock: plan.morningStock,
          receivedGood: plan.receivedGood,
          receivedDamaged: damagedOnDelivery.get(line.productId) ?? 0,
          remaining: entries.get(line.productId)!.remaining,
          sold: plan.sold,
          discardedExpired: plan.discardedExpired,
          discardedDamaged: plan.discardedDamaged,
          closedById: actor.userId,
        },
      });
    }
    await tx.auditLog.create({
      data: { companyId: actor.companyId, actorId: actor.userId, entityType: "ShopDayClose", entityId: actor.shopId, action: "CLOSE", after: { date: input.date, products: plans.length } },
    });
  });
  return plans.map(({ line, plan }) => ({
    productId: line.productId,
    name: line.name,
    sold: plan.sold,
    discardedExpired: plan.discardedExpired,
    discardedDamaged: plan.discardedDamaged,
    kept: plan.kept,
  }));
}

// ---------------------------------------------------------------------------
// Demande 8 : stock des boutiques
// ---------------------------------------------------------------------------

export interface StockRow {
  shopId: string;
  shopName: string;
  productId: string;
  productName: string;
  unit: string;
  family: ProductFamily;
  /** Stock actuel (lots non vendus ni jetés). */
  inStock: number;
  /** À jeter ce soir s'ils ne sont pas vendus (dernier jour de vente atteint). */
  toDiscardTonight: number;
  /** Chiffres du jour consulté (la veille par défaut). */
  day: { received: number | null; damagedOnDelivery: number | null; sold: number | null; discarded: number | null };
}

export interface StockView {
  today: string;
  /** Jour consulté pour « reçus, abîmés, vendus, jetés ». */
  date: string;
  rows: StockRow[];
}

/**
 * Demande 8 : stock de chaque boutique (ou d'une seule), limité au pain pour le boulanger. `date` : jour consulté
 * (la veille par défaut) ; on peut consulter les jours passés.
 */
export async function getShopStock(
  companyId: string,
  options: { shopId?: string | null; date?: string | null; family?: ProductFamily | null },
  deps: { db?: ShopStockDb; now?: Date } = {}
): Promise<StockView> {
  const db = deps.db ?? defaultDb();
  const now = deps.now ?? new Date();
  const todayKey = await today(db, companyId, now);
  const date = options.date ?? addDays(todayKey, -1);
  assertDate(date);
  const shops = await db.merchant.findMany({
    where: { companyId, kind: "SHOP", ...(options.shopId ? { id: options.shopId } : {}) },
    select: { id: true, name: true },
  });
  if (options.shopId && shops.length === 0) throw new DomainRuleError(404, "Boutique introuvable.", "SHOP_NOT_FOUND");
  const shopIds = shops.map((shop) => shop.id);
  const [lots, closes, shipments] = await Promise.all([
    shopIds.length ? db.shopStockLot.findMany({ where: { companyId, shopId: { in: shopIds } }, select: { id: true, shopId: true, productId: true, receivedOn: true, lastSaleDay: true, quantity: true } }) : Promise.resolve([]),
    shopIds.length ? db.shopDayClose.findMany({ where: { companyId, shopId: { in: shopIds }, date: deliveryDateToDb(date) } }) : Promise.resolve([]),
    shopIds.length
      ? db.order.findMany({ where: { companyId, merchantId: { in: shopIds }, deliveryDate: deliveryDateToDb(date), origin: "SHIPMENT" }, select: { id: true, merchantId: true } })
      : Promise.resolve([]),
  ]);
  const receptionLines = shipments.length
    ? await db.orderLine.findMany({ where: { companyId, orderId: { in: shipments.map((order) => order.id) } }, select: { orderId: true, productId: true, quantityReceived: true, quantityDamaged: true } })
    : [];
  const shopOfOrder = new Map(shipments.map((order) => [order.id, order.merchantId]));
  const keys = new Set<string>();
  for (const lot of lots) keys.add(`${lot.shopId}|${lot.productId}`);
  for (const close of closes) keys.add(`${close.shopId}|${close.productId}`);
  for (const line of receptionLines) keys.add(`${shopOfOrder.get(line.orderId)}|${line.productId}`);
  const info = await productInfo(db, companyId, [...new Set([...keys].map((key) => key.split("|")[1]!))]);
  const shopName = new Map(shops.map((shop) => [shop.id, shop.name]));
  const rows: StockRow[] = [];
  for (const key of keys) {
    const [shopId, productId] = key.split("|") as [string, string];
    const product = info.get(productId);
    if (!product || (options.family && product.family !== options.family)) continue;
    const own = lots
      .filter((lot) => lot.shopId === shopId && lot.productId === productId)
      .map((lot) => ({ id: lot.id, receivedOn: dayKey(lot.receivedOn), lastSaleDay: dayKey(lot.lastSaleDay), quantity: lot.quantity }));
    const close = closes.find((row) => row.shopId === shopId && row.productId === productId);
    const reception = receptionLines.find((line) => shopOfOrder.get(line.orderId) === shopId && line.productId === productId);
    rows.push({
      shopId,
      shopName: shopName.get(shopId) ?? "",
      productId,
      productName: product.name,
      unit: product.unit,
      family: product.family,
      inStock: own.reduce((sum, lot) => sum + lot.quantity, 0),
      toDiscardTonight: expiringOn(todayKey, own),
      day: {
        received: reception?.quantityReceived ?? null,
        damagedOnDelivery: reception?.quantityDamaged ?? null,
        sold: close ? close.sold : null,
        discarded: close ? close.discardedExpired + close.discardedDamaged : null,
      },
    });
  }
  rows.sort((a, b) => a.shopName.localeCompare(b.shopName, "fr") || a.productName.localeCompare(b.productName, "fr"));
  return { today: todayKey, date, rows };
}
