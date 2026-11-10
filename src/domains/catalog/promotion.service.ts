/**
 * Lot 1, demande 2 — promotions (fins de série et autres).
 *
 * Administrateur (catalogue) : créer une promotion sur un produit (prix promo ou réduction en %, date de
 * fin, quantité limitée facultative, tous les clients ou certains), voir les promotions en cours et
 * terminées, arrêter une promotion à tout moment. Une seule promotion en cours par produit.
 *
 * Client : `loadPromotionOffers` donne, par produit, l'offre en cours qui le concerne et qui est plus
 * basse que son prix normal (le client paie le moins cher des deux). À la validation d'une commande,
 * `allocatePromotions` retient la part « promo » de chaque ligne (unités et prix), sous un verrou par
 * promotion : deux clients qui valident en même temps ne dépassent jamais la quantité limitée, et la
 * 51ᵉ unité d'une limite de 50 est au prix normal. La part retenue est écrite sur la ligne de commande :
 * une promotion qui se termine ensuite ne change pas une commande déjà validée.
 *
 * Unités retenues = somme des `promoQuantity` des lignes de commandes validées, verrouillées, préparées
 * ou livrées ; une commande annulée rend ses unités. Tout est borné à l'entreprise (PLA-01).
 */
import type { OrderStatus, Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "@/services/prisma/client";
import { loadAppliedPrices, type AppliedPrice } from "@/domains/catalog/pricing";
import {
  promoQuantityFor,
  promotionPriceCents,
  promotionState,
  promotionTargets,
  remainingQuantity,
  type PromotionState,
} from "@/domains/catalog/promotion";
import { companyToday, deliveryDateKey, deliveryDateToDb, toCalendarDate } from "@/domains/order/order-deadline";
import { DomainRuleError } from "@/lib/errors/domain-rule-error";
import { fr } from "@/lib/i18n/fr";
import type { CreatePromotionInput } from "@/lib/validations/catalog";

const t = fr.promotions.errors;

/** Commandes dont les unités promo comptent dans la quantité limitée. */
const COUNTED_STATUSES: OrderStatus[] = ["VALIDATED", "LOCKED", "PREPARED", "DELIVERED"];

type ReadDb = Pick<PrismaClient, "promotion" | "promotionMerchant" | "orderLine" | "order" | "product" | "merchantPrice">;
type AllocDb = ReadDb & Pick<PrismaClient, "$queryRaw">;
export type PromotionDb = ReadDb & Pick<PrismaClient, "company" | "merchant" | "auditLog" | "$transaction" | "$queryRaw">;

export interface PromotionActor {
  companyId: string;
  userId: string;
}

/** Part promo d'une ligne de commande. */
export interface LinePromo {
  promotionId: string | null;
  promoQuantity: number;
  promoUnitPriceCents: number | null;
}

export const NO_PROMO: LinePromo = { promotionId: null, promoQuantity: 0, promoUnitPriceCents: null };

export interface PromotionOffer {
  promotionId: string;
  productId: string;
  /** Prix promo HT pour ce client (strictement plus bas que son prix normal). */
  promoUnitPriceCents: number;
  /** Prix normal du client (négocié ou de base) : l'ancien prix barré. */
  regularUnitPriceCents: number;
  /** Unités encore disponibles, tous clients confondus ; `null` = sans limite. */
  remaining: number | null;
  endsOn: string;
}

export interface PromotionRow {
  id: string;
  productId: string;
  productName: string;
  basePriceCents: number;
  promoPriceCents: number | null;
  discountPercent: number | null;
  /** Prix promo calculé sur le prix de base. */
  promoUnitPriceCents: number;
  endsOn: string;
  quantityLimit: number | null;
  usedQuantity: number;
  allMerchants: boolean;
  merchants: Array<{ id: string; name: string }>;
  state: PromotionState;
  stoppedAt: string | null;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Lectures communes
// ---------------------------------------------------------------------------

/** Unités promo retenues par promotion (commandes non annulées), hors commande `excludeOrderId`. */
export async function usedPromoQuantities(
  db: Pick<PrismaClient, "orderLine" | "order">,
  companyId: string,
  promotionIds: readonly string[],
  excludeOrderId?: string | null
): Promise<Map<string, number>> {
  const used = new Map(promotionIds.map((id) => [id, 0]));
  if (promotionIds.length === 0) return used;
  const lines = await db.orderLine.findMany({
    where: { companyId, promotionId: { in: [...promotionIds] }, promoQuantity: { gt: 0 } },
    select: { orderId: true, promotionId: true, promoQuantity: true },
  });
  const orderIds = [...new Set(lines.map((line) => line.orderId))].filter((id) => id !== excludeOrderId);
  const counted = new Set(
    orderIds.length === 0
      ? []
      : (await db.order.findMany({ where: { companyId, id: { in: orderIds }, status: { in: COUNTED_STATUSES } }, select: { id: true } })).map((order) => order.id)
  );
  for (const line of lines) {
    if (!line.promotionId || !counted.has(line.orderId)) continue;
    used.set(line.promotionId, (used.get(line.promotionId) ?? 0) + line.promoQuantity);
  }
  return used;
}

/** Promotions non arrêtées et non échues des produits donnés (avant contrôle du client et du stock). */
async function candidatePromotions(db: Pick<PrismaClient, "promotion">, companyId: string, today: string, productIds?: readonly string[]) {
  return db.promotion.findMany({
    where: { companyId, stoppedAt: null, endsOn: { gte: deliveryDateToDb(today) }, ...(productIds ? { productId: { in: [...productIds] } } : {}) },
    select: { id: true, productId: true, promoPriceCents: true, discountPercent: true, endsOn: true, quantityLimit: true, allMerchants: true, stoppedAt: true, createdAt: true },
  });
}

/**
 * Offres en cours pour un client, par produit : promotion qui le concerne, non épuisée, et dont le prix
 * est plus bas que son prix normal. `prices` : prix appliqués du client (RG-05) ; `basePrices` : prix de
 * base des produits (base du pourcentage).
 */
async function offersFor(
  db: ReadDb,
  companyId: string,
  merchantId: string,
  today: string,
  promotions: Awaited<ReturnType<typeof candidatePromotions>>,
  basePrices: ReadonlyMap<string, number>,
  prices: ReadonlyMap<string, AppliedPrice>,
  excludeOrderId?: string | null
): Promise<Map<string, PromotionOffer>> {
  const offers = new Map<string, PromotionOffer>();
  if (promotions.length === 0) return offers;
  const reserved = promotions.filter((promotion) => !promotion.allMerchants).map((promotion) => promotion.id);
  const [targets, used] = await Promise.all([
    reserved.length === 0
      ? Promise.resolve([] as Array<{ promotionId: string }>)
      : db.promotionMerchant.findMany({ where: { companyId, merchantId, promotionId: { in: reserved } }, select: { promotionId: true } }),
    usedPromoQuantities(db, companyId, promotions.map((promotion) => promotion.id), excludeOrderId),
  ]);
  const targeted = new Set(targets.map((row) => row.promotionId));
  for (const promotion of promotions) {
    if (!promotionTargets({ allMerchants: promotion.allMerchants, merchantIds: targeted.has(promotion.id) ? [merchantId] : [] }, merchantId)) continue;
    const usedQuantity = used.get(promotion.id) ?? 0;
    const endsOn = deliveryDateKey(promotion.endsOn);
    if (promotionState({ endsOn, stoppedAt: promotion.stoppedAt, quantityLimit: promotion.quantityLimit }, today, usedQuantity) !== "ACTIVE") continue;
    const base = basePrices.get(promotion.productId);
    const regular = prices.get(promotion.productId)?.unitPriceCents;
    if (base === undefined || regular === undefined) continue;
    const promoUnitPriceCents = promotionPriceCents(promotion, base);
    // Prix négocié plus bas que le prix promo : le client garde son prix, la promotion ne le concerne pas.
    if (promoUnitPriceCents >= regular) continue;
    const current = offers.get(promotion.productId);
    if (current && current.promoUnitPriceCents <= promoUnitPriceCents) continue;
    offers.set(promotion.productId, {
      promotionId: promotion.id,
      productId: promotion.productId,
      promoUnitPriceCents,
      regularUnitPriceCents: regular,
      remaining: remainingQuantity(promotion.quantityLimit, usedQuantity),
      endsOn,
    });
  }
  return offers;
}

/** Offres en cours d'un client pour l'affichage du catalogue (CLI-03). */
export async function loadPromotionOffers(
  db: ReadDb,
  companyId: string,
  merchantId: string,
  today: string,
  products: ReadonlyArray<{ id: string; basePriceCents: number }>,
  prices: ReadonlyMap<string, AppliedPrice>
): Promise<Map<string, PromotionOffer>> {
  const promotions = await candidatePromotions(db, companyId, today, products.map((product) => product.id));
  return offersFor(db, companyId, merchantId, today, promotions, new Map(products.map((product) => [product.id, product.basePriceCents])), prices);
}

/**
 * À la validation d'une commande (client ou commande récurrente générée) : part promo de chaque ligne.
 * À appeler dans la transaction qui écrit les lignes. `previous` : part retenue lors d'une validation
 * précédente de la même commande, gardée (à concurrence de la nouvelle quantité) si la promotion n'est
 * plus en cours. `orderId` : commande modifiée, dont les anciennes unités ne comptent pas.
 */
export async function allocatePromotions(
  tx: AllocDb,
  input: {
    companyId: string;
    merchantId: string;
    today: string;
    orderId?: string | null;
    lines: ReadonlyArray<{ productId: string; quantity: number }>;
    previous?: ReadonlyMap<string, LinePromo>;
  }
): Promise<Map<string, LinePromo>> {
  const productIds = input.lines.map((line) => line.productId);
  const result = new Map<string, LinePromo>(productIds.map((id) => [id, NO_PROMO]));
  const promotions = await candidatePromotions(tx, input.companyId, input.today, productIds);
  // Verrou par promotion, dans un ordre fixe : les validations simultanées sont sérialisées.
  for (const id of [...new Set(promotions.map((promotion) => promotion.id))].sort()) {
    const key = `promotion:${id}`;
    await tx.$queryRaw`SELECT 1 AS locked FROM pg_advisory_xact_lock(hashtext(${key}))`;
  }
  let offers = new Map<string, PromotionOffer>();
  if (promotions.length > 0) {
    const [products, prices] = await Promise.all([
      tx.product.findMany({ where: { companyId: input.companyId, id: { in: productIds } }, select: { id: true, basePriceCents: true } }),
      loadAppliedPrices(tx, input.companyId, input.merchantId, productIds),
    ]);
    offers = await offersFor(
      tx, input.companyId, input.merchantId, input.today, promotions,
      new Map(products.map((product) => [product.id, product.basePriceCents])), prices, input.orderId
    );
  }
  // Unités déjà prises dans cette même allocation (une promotion ne couvre qu'un produit, par sécurité).
  const taken = new Map<string, number>();
  for (const line of input.lines) {
    const offer = offers.get(line.productId);
    if (offer) {
      const remaining = offer.remaining === null ? null : offer.remaining - (taken.get(offer.promotionId) ?? 0);
      const promoQuantity = promoQuantityFor(line.quantity, remaining);
      if (promoQuantity > 0) {
        taken.set(offer.promotionId, (taken.get(offer.promotionId) ?? 0) + promoQuantity);
        result.set(line.productId, { promotionId: offer.promotionId, promoQuantity, promoUnitPriceCents: offer.promoUnitPriceCents });
        continue;
      }
    }
    const previous = input.previous?.get(line.productId);
    if (previous?.promotionId && previous.promoQuantity > 0 && !offers.has(line.productId)) {
      // Promotion terminée depuis la validation : la commande garde ses unités promo (jamais plus).
      result.set(line.productId, { ...previous, promoQuantity: Math.min(previous.promoQuantity, line.quantity) });
    }
  }
  return result;
}

/** Données d'une ligne de commande pour la part promo. */
export function linePromoData(promo: LinePromo | undefined) {
  const value = promo && promo.promoQuantity > 0 ? promo : NO_PROMO;
  return { promotionId: value.promotionId, promoQuantity: value.promoQuantity, promoUnitPriceCents: value.promoUnitPriceCents };
}

// ---------------------------------------------------------------------------
// Administrateur
// ---------------------------------------------------------------------------

async function loadTimezone(db: Pick<PrismaClient, "company">, companyId: string) {
  const company = await db.company.findUnique({ where: { id: companyId }, select: { timezone: true } });
  if (!company) throw new DomainRuleError(404, "Entreprise introuvable.", "COMPANY_NOT_FOUND");
  return company.timezone;
}

/** Promotions de l'entreprise : en cours d'abord (fin la plus proche), puis terminées (plus récentes). */
export async function listPromotions(companyId: string, now = new Date(), db: PromotionDb = prisma): Promise<PromotionRow[]> {
  const today = companyToday(now, await loadTimezone(db, companyId));
  const promotions = await db.promotion.findMany({
    where: { companyId },
    orderBy: { createdAt: "desc" },
    take: 500,
    select: {
      id: true, productId: true, promoPriceCents: true, discountPercent: true, endsOn: true, quantityLimit: true,
      allMerchants: true, stoppedAt: true, createdAt: true,
    },
  });
  const ids = promotions.map((promotion) => promotion.id);
  const [products, targets, used] = await Promise.all([
    db.product.findMany({ where: { companyId, id: { in: [...new Set(promotions.map((promotion) => promotion.productId))] } }, select: { id: true, name: true, basePriceCents: true } }),
    ids.length === 0 ? Promise.resolve([]) : db.promotionMerchant.findMany({ where: { companyId, promotionId: { in: ids } }, select: { promotionId: true, merchantId: true } }),
    usedPromoQuantities(db, companyId, ids),
  ]);
  const merchants = targets.length === 0
    ? []
    : await db.merchant.findMany({ where: { companyId, id: { in: [...new Set(targets.map((row) => row.merchantId))] } }, select: { id: true, name: true, tradeName: true } });
  const productById = new Map(products.map((product) => [product.id, product]));
  const merchantName = new Map(merchants.map((merchant) => [merchant.id, merchant.tradeName || merchant.name]));
  const rows = promotions.map((promotion): PromotionRow => {
    const product = productById.get(promotion.productId);
    const usedQuantity = used.get(promotion.id) ?? 0;
    const endsOn = deliveryDateKey(promotion.endsOn);
    return {
      id: promotion.id,
      productId: promotion.productId,
      productName: product?.name ?? "",
      basePriceCents: product?.basePriceCents ?? 0,
      promoPriceCents: promotion.promoPriceCents,
      discountPercent: promotion.discountPercent,
      promoUnitPriceCents: promotionPriceCents(promotion, product?.basePriceCents ?? 0),
      endsOn,
      quantityLimit: promotion.quantityLimit,
      usedQuantity,
      allMerchants: promotion.allMerchants,
      merchants: targets
        .filter((row) => row.promotionId === promotion.id)
        .map((row) => ({ id: row.merchantId, name: merchantName.get(row.merchantId) ?? "" }))
        .sort((a, b) => a.name.localeCompare(b.name, "fr")),
      state: promotionState({ endsOn, stoppedAt: promotion.stoppedAt, quantityLimit: promotion.quantityLimit }, today, usedQuantity),
      stoppedAt: promotion.stoppedAt?.toISOString() ?? null,
      createdAt: promotion.createdAt.toISOString(),
    };
  });
  const active = rows.filter((row) => row.state === "ACTIVE").sort((a, b) => a.endsOn.localeCompare(b.endsOn) || a.productName.localeCompare(b.productName, "fr"));
  const ended = rows.filter((row) => row.state !== "ACTIVE");
  return [...active, ...ended];
}

/** Crée une promotion ; refuse un produit qui a déjà une promotion en cours (409). */
export async function createPromotion(actor: PromotionActor, input: CreatePromotionInput, now = new Date(), db: PromotionDb = prisma): Promise<PromotionRow> {
  const today = companyToday(now, await loadTimezone(db, actor.companyId));
  if (!toCalendarDate(input.endsOn)) throw new DomainRuleError(400, t.invalidDate, "INVALID_DATE");
  if (input.endsOn < today) throw new DomainRuleError(400, t.endInPast, "END_IN_PAST");
  const product = await db.product.findFirst({ where: { id: input.productId, companyId: actor.companyId }, select: { id: true, name: true, basePriceCents: true, active: true } });
  if (!product) throw new DomainRuleError(404, t.productNotFound, "PRODUCT_NOT_FOUND");
  const terms = { promoPriceCents: input.promoPriceCents ?? null, discountPercent: input.discountPercent ?? null };
  if (typeof terms.promoPriceCents === "number" && terms.promoPriceCents >= product.basePriceCents) {
    throw new DomainRuleError(400, t.priceNotLower, "PROMO_PRICE_NOT_LOWER");
  }
  const merchantIds = input.allMerchants ? [] : [...new Set(input.merchantIds ?? [])];
  if (!input.allMerchants && merchantIds.length === 0) throw new DomainRuleError(400, t.noMerchant, "NO_MERCHANT");
  if (merchantIds.length > 0) {
    const found = await db.merchant.count({ where: { companyId: actor.companyId, id: { in: merchantIds } } });
    if (found !== merchantIds.length) throw new DomainRuleError(404, t.merchantNotFound, "MERCHANT_NOT_FOUND");
  }

  const created = await db.$transaction(async (tx) => {
    // Une seule promotion en cours par produit (verrou par produit contre deux créations simultanées).
    const key = `promotion-product:${product.id}`;
    await tx.$queryRaw`SELECT 1 AS locked FROM pg_advisory_xact_lock(hashtext(${key}))`;
    const current = await candidatePromotions(tx, actor.companyId, today, [product.id]);
    const used = await usedPromoQuantities(tx, actor.companyId, current.map((promotion) => promotion.id));
    const running = current.some(
      (promotion) => promotionState({ endsOn: deliveryDateKey(promotion.endsOn), stoppedAt: promotion.stoppedAt, quantityLimit: promotion.quantityLimit }, today, used.get(promotion.id) ?? 0) === "ACTIVE"
    );
    if (running) throw new DomainRuleError(409, t.alreadyRunning, "PROMOTION_ALREADY_RUNNING");
    const promotion = await tx.promotion.create({
      data: {
        companyId: actor.companyId,
        productId: product.id,
        promoPriceCents: terms.promoPriceCents,
        discountPercent: terms.discountPercent,
        endsOn: deliveryDateToDb(input.endsOn),
        quantityLimit: input.quantityLimit ?? null,
        allMerchants: input.allMerchants,
        stoppedAt: null,
        createdById: actor.userId,
      },
    });
    if (merchantIds.length > 0) {
      await tx.promotionMerchant.createMany({ data: merchantIds.map((merchantId) => ({ promotionId: promotion.id, merchantId, companyId: actor.companyId })) });
    }
    await tx.auditLog.create({
      data: {
        companyId: actor.companyId,
        actorId: actor.userId,
        entityType: "Promotion",
        entityId: promotion.id,
        action: "CREATE",
        after: { productId: product.id, ...terms, endsOn: input.endsOn, quantityLimit: input.quantityLimit ?? null, allMerchants: input.allMerchants, merchantIds } as Prisma.InputJsonValue,
      },
    });
    return promotion;
  });
  const rows = await listPromotions(actor.companyId, now, db);
  return rows.find((row) => row.id === created.id)!;
}

/** Arrête une promotion tout de suite : les nouvelles commandes reviennent au prix normal. */
export async function stopPromotion(actor: PromotionActor, promotionId: string, now = new Date(), db: PromotionDb = prisma): Promise<PromotionRow> {
  const promotion = await db.promotion.findFirst({ where: { id: promotionId, companyId: actor.companyId }, select: { id: true, stoppedAt: true } });
  if (!promotion) throw new DomainRuleError(404, t.notFound, "PROMOTION_NOT_FOUND");
  if (promotion.stoppedAt) throw new DomainRuleError(409, t.alreadyStopped, "PROMOTION_ALREADY_STOPPED");
  await db.promotion.updateMany({ where: { id: promotion.id, companyId: actor.companyId, stoppedAt: null }, data: { stoppedAt: now } });
  await db.auditLog.create({
    data: { companyId: actor.companyId, actorId: actor.userId, entityType: "Promotion", entityId: promotion.id, action: "STOP", after: { stoppedAt: now.toISOString() } },
  });
  const rows = await listPromotions(actor.companyId, now, db);
  return rows.find((row) => row.id === promotion.id)!;
}
