/**
 * Lot 2, demande 9 — commandes de gâteaux des particuliers, prises en boutique par la vendeuse (la vente en ligne
 * aux particuliers reste exclue).
 *
 * La vendeuse enregistre : gâteau et taille, inscription, nombre de parts, paiement (réglé en totalité, ou acompte
 * et son montant), nom et téléphone du client, date et heure de retrait. Règles :
 * - pas de commande sans paiement : prix complet, ou acompte d'au moins 50 % du prix (sinon refus) ;
 * - le prix est le prix boutique de la taille réglé par la responsable (demande 4), lu sur le serveur : la
 *   vendeuse ne le saisit ni ne le modifie (demande 4, vérification 4) ; sans prix boutique, pas de commande ;
 * - au moins 48 h entre la commande et le retrait, délai réglable par l'administrateur
 *   (`Company.settings.cakeOrderLeadHours`) ;
 * - le gâteau entre dans la production du pâtissier le jour du retrait (avec son inscription) et part dans
 *   l'envoi du matin vers la boutique : une ligne de cet envoi lui est réservée (`OrderLine.cakeOrderId`) ;
 * - au retrait, la vendeuse marque la commande « soldée ».
 */
import type { Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "@/services/prisma/client";
import { DomainRuleError } from "@/lib/errors/domain-rule-error";
import { companyToday, deliveryDateKey, deliveryDateToDb } from "@/domains/order/order-deadline";
import { newReference } from "@/domains/order/merchant-order.service";
import { lockDeliveryDate } from "@/domains/order/order-lock.service";
import { isEditable, morningSlots, type ShipmentDb } from "@/domains/shop/shipment.service";

export type CakeOrderDb = ShipmentDb & Pick<PrismaClient, "cakeOrder" | "productSize" | "shopPrice">;
const defaultDb = () => prisma as unknown as CakeOrderDb;

export const DEFAULT_CAKE_ORDER_LEAD_HOURS = 48;

export interface CakeChoice {
  productId: string;
  name: string;
  sizes: Array<{ sizeId: string; servings: number; priceCents: number }>;
}

export interface CakeOrderRow {
  id: string;
  productName: string;
  servings: number;
  sizeServings: number;
  inscription: string | null;
  priceCents: number;
  payment: "FULL" | "DEPOSIT";
  paidCents: number;
  /** Reste à payer au retrait. */
  dueCents: number;
  customerName: string;
  customerPhone: string;
  pickupAt: string;
  pickupDate: string;
  status: "ORDERED" | "SETTLED" | "CANCELLED";
}

export interface CreateCakeOrderInput {
  productId: string;
  sizeId: string;
  inscription: string | null;
  servings: number;
  payment: "FULL" | "DEPOSIT";
  /** Montant de l'acompte (centimes) ; ignoré pour un paiement complet. */
  depositCents: number | null;
  customerName: string;
  customerPhone: string;
  /** Instant du retrait (ISO). */
  pickupAt: string;
}

/** Délai minimum entre la commande et le retrait, en heures (réglage de l'administrateur). */
export function readCakeLeadHours(settings: Prisma.JsonValue | null | undefined): number {
  const value = settings && typeof settings === "object" && !Array.isArray(settings) ? (settings as Record<string, unknown>).cakeOrderLeadHours : undefined;
  return typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= 24 * 30 ? value : DEFAULT_CAKE_ORDER_LEAD_HOURS;
}

/** Acompte minimal : la moitié du prix, arrondie au centime supérieur. */
export function minimumDepositCents(priceCents: number): number {
  return Math.ceil(priceCents / 2);
}

/** Gros gâteaux commandables dans la boutique : tailles ayant un prix boutique (vendu). */
export async function listCakeChoices(companyId: string, shopId: string, db: CakeOrderDb = defaultDb()): Promise<CakeChoice[]> {
  const [products, sizes, prices] = await Promise.all([
    db.product.findMany({ where: { companyId, active: true, pastryFormat: "LARGE" }, select: { id: true, name: true } }),
    db.productSize.findMany({ where: { companyId }, select: { id: true, productId: true, servings: true } }),
    db.shopPrice.findMany({ where: { companyId, shopId, sold: true }, select: { productId: true, sizeId: true, priceCents: true } }),
  ]);
  return products
    .map((product) => ({
      productId: product.id,
      name: product.name,
      sizes: sizes
        .filter((size) => size.productId === product.id)
        .map((size) => ({ size, price: prices.find((price) => price.productId === product.id && price.sizeId === size.id)?.priceCents ?? null }))
        .filter((row): row is { size: typeof row.size; price: number } => typeof row.price === "number" && row.price > 0)
        .map(({ size, price }) => ({ sizeId: size.id, servings: size.servings, priceCents: price }))
        .sort((a, b) => a.servings - b.servings),
    }))
    .filter((choice) => choice.sizes.length > 0)
    .sort((a, b) => a.name.localeCompare(b.name, "fr"));
}

function toRow(row: {
  id: string;
  servings: number;
  inscription: string | null;
  priceCents: number;
  payment: "FULL" | "DEPOSIT";
  paidCents: number;
  customerName: string;
  customerPhone: string;
  pickupAt: Date;
  pickupDate: Date;
  status: "ORDERED" | "SETTLED" | "CANCELLED";
  productId: string;
  sizeId: string;
}, names: Map<string, string>, sizes: Map<string, number>): CakeOrderRow {
  return {
    id: row.id,
    productName: names.get(row.productId) ?? "",
    servings: row.servings,
    sizeServings: sizes.get(row.sizeId) ?? row.servings,
    inscription: row.inscription,
    priceCents: row.priceCents,
    payment: row.payment,
    paidCents: row.paidCents,
    dueCents: row.status === "SETTLED" ? 0 : row.priceCents - row.paidCents,
    customerName: row.customerName,
    customerPhone: row.customerPhone,
    pickupAt: row.pickupAt.toISOString(),
    pickupDate: deliveryDateKey(row.pickupDate),
    status: row.status,
  };
}

/** Commandes de la boutique à retirer à partir de `fromDate` (incluse). */
export async function listCakeOrders(companyId: string, shopId: string, fromDate: string, db: CakeOrderDb = defaultDb()): Promise<CakeOrderRow[]> {
  const rows = await db.cakeOrder.findMany({ where: { companyId, shopId, pickupDate: { gte: deliveryDateToDb(fromDate) } } });
  const [products, sizes] = await Promise.all([
    db.product.findMany({ where: { companyId, id: { in: [...new Set(rows.map((row) => row.productId))] } }, select: { id: true, name: true } }),
    db.productSize.findMany({ where: { companyId, id: { in: [...new Set(rows.map((row) => row.sizeId))] } }, select: { id: true, servings: true } }),
  ]);
  const names = new Map(products.map((product) => [product.id, product.name]));
  const sizeServings = new Map(sizes.map((size) => [size.id, size.servings]));
  return rows
    .map((row) => toRow(row, names, sizeServings))
    .sort((a, b) => a.pickupAt.localeCompare(b.pickupAt) || a.customerName.localeCompare(b.customerName, "fr"));
}

export interface CakeDeps {
  db?: CakeOrderDb;
  now?: Date;
  addToRounds?: (companyId: string, date: string) => Promise<unknown>;
}

/** Demande 9 : la vendeuse enregistre la commande d'un client (vérifications 1 à 4). */
export async function createCakeOrder(
  actor: { companyId: string; userId: string; shopId: string },
  input: CreateCakeOrderInput,
  deps: CakeDeps = {}
): Promise<CakeOrderRow> {
  const db = deps.db ?? defaultDb();
  const now = deps.now ?? new Date();
  const company = await db.company.findUnique({ where: { id: actor.companyId }, select: { timezone: true, settings: true } });
  if (!company) throw new DomainRuleError(404, "Entreprise introuvable.", "COMPANY_NOT_FOUND");
  const shop = await db.merchant.findFirst({ where: { id: actor.shopId, companyId: actor.companyId, kind: "SHOP", active: true }, select: { id: true, zoneId: true } });
  if (!shop) throw new DomainRuleError(404, "Boutique introuvable.", "SHOP_NOT_FOUND");

  // Prix : celui de la boutique pour cette taille, jamais celui de la saisie.
  const size = await db.productSize.findFirst({ where: { id: input.sizeId, companyId: actor.companyId, productId: input.productId }, select: { id: true, servings: true } });
  if (!size) throw new DomainRuleError(404, "Taille introuvable pour ce gâteau.", "SIZE_NOT_FOUND");
  const shopPrice = await db.shopPrice.findFirst({
    where: { companyId: actor.companyId, shopId: shop.id, productId: input.productId, sizeKey: size.id, sold: true },
    select: { priceCents: true },
  });
  const priceCents = shopPrice?.priceCents ?? null;
  if (!priceCents) throw new DomainRuleError(400, "Ce gâteau n'a pas de prix boutique pour cette taille : la responsable doit le saisir dans « Produits et prix ».", "NO_SHOP_PRICE");

  // Paiement : complet, ou acompte d'au moins 50 % (vérification 1 : 15 € sur 40 € refusé).
  let paidCents: number;
  if (input.payment === "FULL") paidCents = priceCents;
  else {
    const deposit = input.depositCents ?? 0;
    const minimum = minimumDepositCents(priceCents);
    if (!Number.isInteger(deposit) || deposit < minimum) {
      throw new DomainRuleError(400, `Acompte insuffisant : au moins ${(minimum / 100).toFixed(2).replace(".", ",")} € (50 % du prix).`, "DEPOSIT_TOO_LOW");
    }
    if (deposit >= priceCents) paidCents = priceCents;
    else paidCents = deposit;
  }

  // Délai : au moins N heures avant le retrait (48 h par défaut).
  const pickupAt = new Date(input.pickupAt);
  if (Number.isNaN(pickupAt.getTime())) throw new DomainRuleError(400, "Date de retrait invalide.", "PICKUP_INVALID");
  const leadHours = readCakeLeadHours(company.settings);
  if (pickupAt.getTime() - now.getTime() < leadHours * 3_600_000) {
    throw new DomainRuleError(400, `Une commande se passe au moins ${leadHours} h avant le retrait.`, "PICKUP_TOO_SOON");
  }
  const pickupDate = companyToday(pickupAt, company.timezone);
  if (!shop.zoneId) throw new DomainRuleError(409, "Boutique sans tournée : le gâteau ne peut pas être livré. Prévenez l'administrateur.", "SHOP_WITHOUT_ZONE");
  const slotId = (await morningSlots(db, actor.companyId, [shop.zoneId])).get(shop.zoneId);
  if (!slotId) throw new DomainRuleError(409, "La tournée de la boutique n'a pas de livraison du matin.", "NO_MORNING_SLOT");

  const created = await db.$transaction(async (tx) => {
    const deliveryDate = deliveryDateToDb(pickupDate);
    let order = await tx.order.findFirst({ where: { companyId: actor.companyId, merchantId: shop.id, deliveryDate, slotId }, select: { id: true, status: true, origin: true } });
    if (order && order.origin !== "SHIPMENT") throw new DomainRuleError(409, "Une autre commande occupe ce créneau pour la boutique.", "SLOT_TAKEN");
    if (order && !(await isEditable(tx as unknown as ShipmentDb, actor.companyId, order))) {
      throw new DomainRuleError(409, "La tournée de ce jour est partie : choisissez un autre jour de retrait.", "SHIPMENT_DEPARTED");
    }
    if (!order) {
      order = await tx.order.create({
        data: { companyId: actor.companyId, reference: newReference(pickupDate), merchantId: shop.id, deliveryDate, slotId, status: "LOCKED", origin: "SHIPMENT", validatedAt: now, lockedAt: now, createdById: actor.userId },
        select: { id: true, status: true, origin: true },
      });
    }
    const cake = await tx.cakeOrder.create({
      data: {
        companyId: actor.companyId,
        shopId: shop.id,
        productId: input.productId,
        sizeId: size.id,
        inscription: input.inscription?.trim() || null,
        servings: input.servings,
        priceCents,
        payment: input.payment,
        paidCents,
        customerName: input.customerName.trim(),
        customerPhone: input.customerPhone.trim(),
        pickupAt,
        pickupDate: deliveryDate,
        createdById: actor.userId,
      },
    });
    // Le gâteau part dans l'envoi du matin du jour du retrait (vérification 4).
    await tx.orderLine.create({
      data: {
        companyId: actor.companyId,
        orderId: order.id,
        productId: input.productId,
        quantityOrdered: 1,
        sizeId: size.id,
        inscription: cake.inscription,
        cakeOrderId: cake.id,
        variantKey: `cake:${cake.id}`,
      },
    });
    await tx.auditLog.create({
      data: {
        companyId: actor.companyId,
        actorId: actor.userId,
        entityType: "CakeOrder",
        entityId: cake.id,
        action: "CREATE",
        after: { productId: input.productId, sizeId: size.id, priceCents, payment: input.payment, paidCents, pickupDate },
      },
    });
    return cake;
  });
  await (deps.addToRounds ?? ((companyId: string, date: string) => lockDeliveryDate(companyId, date, { now })))(actor.companyId, pickupDate);
  const product = await db.product.findFirst({ where: { id: input.productId, companyId: actor.companyId }, select: { name: true } });
  return toRow(created, new Map([[input.productId, product?.name ?? ""]]), new Map([[size.id, size.servings]]));
}

/** Demande 9, vérification 5 : au retrait, une fois le reste payé, la commande est « soldée ». */
export async function settleCakeOrder(actor: { companyId: string; userId: string; shopId: string }, cakeOrderId: string, deps: { db?: CakeOrderDb; now?: Date } = {}) {
  const db = deps.db ?? defaultDb();
  const now = deps.now ?? new Date();
  const cake = await db.cakeOrder.findFirst({ where: { id: cakeOrderId, companyId: actor.companyId, shopId: actor.shopId } });
  if (!cake) throw new DomainRuleError(404, "Commande introuvable.", "CAKE_ORDER_NOT_FOUND");
  if (cake.status !== "ORDERED") throw new DomainRuleError(409, "Cette commande est déjà soldée.", "CAKE_ORDER_NOT_OPEN");
  await db.cakeOrder.update({ where: { id: cake.id }, data: { status: "SETTLED", settledAt: now, paidCents: cake.priceCents } });
  await db.auditLog.create({ data: { companyId: actor.companyId, actorId: actor.userId, entityType: "CakeOrder", entityId: cake.id, action: "SETTLE" } });
  return (await listCakeOrders(actor.companyId, actor.shopId, deliveryDateKey(cake.pickupDate), db)).find((row) => row.id === cake.id)!;
}
