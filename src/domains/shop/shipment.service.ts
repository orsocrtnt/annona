/**
 * Lot 2, demande 5 — envois quotidiens du laboratoire vers les boutiques.
 *
 * Chaque jour, le pâtissier choisit une boutique, puis les pâtisseries et les quantités qu'il lui envoie ; le
 * boulanger fait de même pour le pain. Les envois sont décidés par le laboratoire : la boutique ne commande pas.
 *
 * Un envoi est une commande d'origine `SHIPMENT` vers la boutique (`Merchant.kind = SHOP`), sur le créneau du
 * matin de sa tournée (décision de Théo du 18 novembre). Pâtissier et boulanger remplissent la **même** commande,
 * chacun ses produits : l'arrêt de la boutique porte donc pain et pâtisserie (vérification 3). La commande est
 * verrouillée dès sa création (rien à valider ni à facturer) : elle entre dans la production du jour, dans le
 * calcul des tournées à l'heure limite, et, si les tournées sont déjà calculées, elle est ajoutée à une tournée
 * brouillon (`lockDeliveryDate`, même règle que les commandes en retard). Le livreur voit la liste des produits
 * sur l'arrêt (vérification 2).
 *
 * Un envoi se modifie jusqu'au départ de la tournée : refusé (409) dès que la tournée a démarré ou que l'arrêt
 * est livré. Un envoi vidé de tous ses produits disparaît, avec son arrêt. La quantité envoyée sert de référence
 * à la réception du matin (demande 6). Les gros gâteaux partent avec les commandes des particuliers (demande 9),
 * pas ici. Chaque enregistrement est journalisé (entité « Shipment »).
 */
import type { PrismaClient, ProductFamily } from "@prisma/client";
import { prisma } from "@/services/prisma/client";
import { DomainRuleError } from "@/lib/errors/domain-rule-error";
import { companyToday, deliveryDateKey, deliveryDateToDb, toCalendarDate } from "@/domains/order/order-deadline";
import { newReference } from "@/domains/order/merchant-order.service";
import { lockDeliveryDate } from "@/domains/order/order-lock.service";

export type ShipmentDb = Pick<
  PrismaClient,
  "company" | "merchant" | "slot" | "order" | "orderLine" | "product" | "category" | "stop" | "round" | "auditLog" | "$transaction"
>;
const defaultDb = () => prisma as unknown as ShipmentDb;

export const SHIPMENT_AUDIT_ENTITY = "Shipment";
/** La tournée est partie : l'envoi ne se modifie plus. */
const DEPARTED_ROUND_STATUSES = new Set(["IN_PROGRESS", "COMPLETED"]);

export interface ShipmentActor {
  companyId: string;
  userId: string;
  /** Pâtissier : PASTRY ; boulanger : BREAD. */
  family: ProductFamily;
}

export interface ShipmentProduct {
  id: string;
  name: string;
  unit: string;
  categoryName: string;
}

export interface ShipmentShop {
  id: string;
  name: string;
  zoneName: string | null;
  /** Pas de tournée ou pas de créneau du matin : aucun envoi possible (message pour le laboratoire). */
  blockedReason: string | null;
  /** Quantités déjà prévues de la famille du compte, par produit. */
  lines: Array<{ productId: string; quantity: number }>;
  /** Produits de l'autre famille déjà sur le même envoi (lecture seule). */
  otherFamilyItemCount: number;
  orderId: string | null;
  /** Faux dès que la tournée est partie ou l'arrêt livré. */
  editable: boolean;
}

export interface ShipmentDay {
  date: string;
  family: ProductFamily;
  products: ShipmentProduct[];
  shops: ShipmentShop[];
}

async function morningSlots(db: ShipmentDb, companyId: string, zoneIds: string[]) {
  if (zoneIds.length === 0) return new Map<string, string>();
  const slots = await db.slot.findMany({ where: { companyId, zoneId: { in: zoneIds }, period: "MORNING", active: true }, select: { id: true, zoneId: true } });
  return new Map(slots.filter((slot) => slot.zoneId).map((slot) => [slot.zoneId!, slot.id]));
}

async function familyProducts(db: ShipmentDb, companyId: string, family: ProductFamily) {
  const [categories, products] = await Promise.all([
    db.category.findMany({ where: { companyId }, select: { id: true, name: true, family: true, active: true, sortOrder: true } }),
    db.product.findMany({ where: { companyId, active: true }, select: { id: true, name: true, unit: true, categoryId: true, sortOrder: true, pastryFormat: true } }),
  ]);
  const categoryById = new Map(categories.map((category) => [category.id, category]));
  return products
    .filter((product) => {
      const category = categoryById.get(product.categoryId);
      return category?.active && category.family === family && product.pastryFormat !== "LARGE";
    })
    .sort((a, b) => {
      const ca = categoryById.get(a.categoryId)!;
      const cb = categoryById.get(b.categoryId)!;
      return ca.sortOrder - cb.sortOrder || a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, "fr");
    })
    .map((product) => ({ id: product.id, name: product.name, unit: product.unit, categoryName: categoryById.get(product.categoryId)!.name }));
}

/** Un envoi est-il encore modifiable ? Non si la tournée a démarré, si l'arrêt est livré ou en incident. */
async function isEditable(db: ShipmentDb, companyId: string, order: { id: string; status: string }) {
  if (order.status === "DELIVERED" || order.status === "CANCELLED") return false;
  const stop = await db.stop.findFirst({ where: { companyId, orderId: order.id }, select: { roundId: true, status: true } });
  if (!stop) return true;
  if (stop.status !== "PENDING") return false;
  const round = await db.round.findFirst({ where: { companyId, id: stop.roundId }, select: { status: true } });
  return !round || !DEPARTED_ROUND_STATUSES.has(round.status);
}

/** Écran d'envoi du jour : boutiques actives, produits de la famille du compte et quantités déjà prévues. */
export async function getShipmentDay(companyId: string, family: ProductFamily, date: string, db: ShipmentDb = defaultDb()): Promise<ShipmentDay> {
  if (!toCalendarDate(date)) throw new DomainRuleError(400, "Date invalide.", "INVALID_DATE");
  const [shops, products] = await Promise.all([
    db.merchant.findMany({ where: { companyId, kind: "SHOP", active: true }, select: { id: true, name: true, zoneId: true } }),
    familyProducts(db, companyId, family),
  ]);
  const zoneIds = [...new Set(shops.map((shop) => shop.zoneId).filter((id): id is string => Boolean(id)))];
  const [slotByZone, zones] = await Promise.all([
    morningSlots(db, companyId, zoneIds),
    zoneIds.length ? (db as unknown as Pick<PrismaClient, "deliveryZone">).deliveryZone.findMany({ where: { companyId, id: { in: zoneIds } }, select: { id: true, name: true } }) : Promise.resolve([]),
  ]);
  const zoneName = new Map(zones.map((zone) => [zone.id, zone.name]));
  const orders = shops.length
    ? await db.order.findMany({
        where: { companyId, deliveryDate: deliveryDateToDb(date), origin: "SHIPMENT", merchantId: { in: shops.map((shop) => shop.id) } },
        select: { id: true, merchantId: true, status: true },
      })
    : [];
  const lines = orders.length
    ? await db.orderLine.findMany({ where: { companyId, orderId: { in: orders.map((order) => order.id) } }, select: { orderId: true, productId: true, quantityOrdered: true } })
    : [];
  const familyIds = new Set(products.map((product) => product.id));
  const result: ShipmentShop[] = [];
  for (const shop of shops.sort((a, b) => a.name.localeCompare(b.name, "fr"))) {
    const order = orders.find((row) => row.merchantId === shop.id) ?? null;
    const own = order ? lines.filter((line) => line.orderId === order.id) : [];
    const slotId = shop.zoneId ? slotByZone.get(shop.zoneId) : undefined;
    result.push({
      id: shop.id,
      name: shop.name,
      zoneName: shop.zoneId ? zoneName.get(shop.zoneId) ?? null : null,
      blockedReason: !shop.zoneId ? "Boutique sans tournée : l'administrateur doit la rattacher à une tournée." : !slotId ? "La tournée de cette boutique n'a pas de livraison du matin active." : null,
      lines: own.filter((line) => familyIds.has(line.productId)).map((line) => ({ productId: line.productId, quantity: line.quantityOrdered })),
      otherFamilyItemCount: own.filter((line) => !familyIds.has(line.productId)).reduce((sum, line) => sum + line.quantityOrdered, 0),
      orderId: order?.id ?? null,
      editable: order ? await isEditable(db, companyId, order) : true,
    });
  }
  return { date, family, products, shops: result };
}

export interface SaveShipmentInput {
  date: string;
  shopId: string;
  lines: ReadonlyArray<{ productId: string; quantity: number }>;
}

export interface ShipmentDeps {
  db?: ShipmentDb;
  now?: Date;
  /** Ajout aux tournées déjà calculées (par défaut : `lockDeliveryDate`, sans effet avant l'heure limite). */
  addToRounds?: (companyId: string, date: string) => Promise<unknown>;
}

/**
 * Demande 5 : enregistre les quantités de la famille du compte pour une boutique et une date. Les produits de
 * l'autre famille du même envoi ne sont jamais touchés.
 */
export async function saveShipment(actor: ShipmentActor, input: SaveShipmentInput, deps: ShipmentDeps = {}): Promise<ShipmentShop> {
  const db = deps.db ?? defaultDb();
  const now = deps.now ?? new Date();
  if (!toCalendarDate(input.date)) throw new DomainRuleError(400, "Date invalide.", "INVALID_DATE");
  const company = await db.company.findUnique({ where: { id: actor.companyId }, select: { timezone: true } });
  if (!company) throw new DomainRuleError(404, "Entreprise introuvable.", "COMPANY_NOT_FOUND");
  if (input.date < companyToday(now, company.timezone)) throw new DomainRuleError(400, "On n'envoie rien dans le passé.", "DATE_IN_PAST");
  const shop = await db.merchant.findFirst({ where: { id: input.shopId, companyId: actor.companyId, kind: "SHOP", active: true }, select: { id: true, zoneId: true } });
  if (!shop) throw new DomainRuleError(404, "Boutique introuvable.", "SHOP_NOT_FOUND");
  if (!shop.zoneId) throw new DomainRuleError(409, "Boutique sans tournée : l'administrateur doit la rattacher à une tournée.", "SHOP_WITHOUT_ZONE");
  const slotId = (await morningSlots(db, actor.companyId, [shop.zoneId])).get(shop.zoneId);
  if (!slotId) throw new DomainRuleError(409, "La tournée de cette boutique n'a pas de livraison du matin active.", "NO_MORNING_SLOT");

  const allowed = new Set((await familyProducts(db, actor.companyId, actor.family)).map((product) => product.id));
  const wanted = new Map<string, number>();
  for (const line of input.lines) {
    if (!allowed.has(line.productId)) {
      throw new DomainRuleError(400, actor.family === "PASTRY" ? "Seules les pâtisseries (hors gros gâteaux) partent dans cet envoi." : "Seul le pain part dans cet envoi.", "PRODUCT_NOT_IN_FAMILY", { productId: line.productId });
    }
    if (line.quantity > 0) wanted.set(line.productId, (wanted.get(line.productId) ?? 0) + line.quantity);
  }

  const deliveryDate = deliveryDateToDb(input.date);
  const orderId = await db.$transaction(async (tx) => {
    let order = await tx.order.findFirst({ where: { companyId: actor.companyId, merchantId: shop.id, deliveryDate, slotId }, select: { id: true, status: true, origin: true } });
    if (order && order.origin !== "SHIPMENT") throw new DomainRuleError(409, "Une autre commande occupe déjà ce créneau pour cette boutique.", "SLOT_TAKEN");
    if (order && !(await isEditable(tx as unknown as ShipmentDb, actor.companyId, order))) {
      throw new DomainRuleError(409, "La tournée est partie : cet envoi ne se modifie plus.", "SHIPMENT_DEPARTED");
    }
    const before = order ? await tx.orderLine.findMany({ where: { companyId: actor.companyId, orderId: order.id }, select: { id: true, productId: true, quantityOrdered: true } }) : [];
    if (!order && wanted.size === 0) return null;
    if (!order) {
      order = await tx.order.create({
        data: {
          companyId: actor.companyId,
          reference: newReference(input.date),
          merchantId: shop.id,
          deliveryDate,
          slotId,
          status: "LOCKED",
          origin: "SHIPMENT",
          validatedAt: now,
          lockedAt: now,
          createdById: actor.userId,
        },
        select: { id: true, status: true, origin: true },
      });
    }
    const familyLines = before.filter((line) => allowed.has(line.productId));
    if (familyLines.length) await tx.orderLine.deleteMany({ where: { companyId: actor.companyId, id: { in: familyLines.map((line) => line.id) } } });
    if (wanted.size) {
      await tx.orderLine.createMany({
        data: [...wanted].map(([productId, quantity]) => ({ companyId: actor.companyId, orderId: order!.id, productId, quantityOrdered: quantity })),
      });
    }
    const remaining = before.length - familyLines.length + wanted.size;
    await tx.auditLog.create({
      data: {
        companyId: actor.companyId,
        actorId: actor.userId,
        entityType: SHIPMENT_AUDIT_ENTITY,
        entityId: order.id,
        action: remaining === 0 ? "DELETE" : before.length ? "UPDATE" : "CREATE",
        before: { family: actor.family, lines: familyLines.map((line) => ({ productId: line.productId, quantity: line.quantityOrdered })) },
        after: { family: actor.family, shopId: shop.id, date: input.date, lines: [...wanted].map(([productId, quantity]) => ({ productId, quantity })) },
      },
    });
    if (remaining === 0) {
      // Envoi vidé : il disparaît, avec son arrêt (la tournée n'est pas partie).
      await tx.stop.deleteMany({ where: { companyId: actor.companyId, orderId: order.id } });
      await tx.order.deleteMany({ where: { companyId: actor.companyId, id: order.id } });
      return null;
    }
    return order.id;
  });
  // Tournées déjà calculées (après l'heure limite) : l'arrêt de la boutique s'y ajoute ; avant, rien à faire.
  if (orderId) await (deps.addToRounds ?? ((companyId: string, date: string) => lockDeliveryDate(companyId, date, { now })))(actor.companyId, input.date);
  const day = await getShipmentDay(actor.companyId, actor.family, deliveryDateKey(deliveryDate), db);
  return day.shops.find((row) => row.id === shop.id)!;
}
