/**
 * Lot 2, demande 1 — boutiques de l'entreprise (les magasins qui reçoivent chaque matin les envois du
 * laboratoire) et leurs comptes vendeuse.
 *
 * Une boutique est un `Merchant` de type `SHOP` : elle reprend l'adresse, les consignes d'accès, la position
 * et la tournée d'un client, donc sa place dans les tournées du livreur, sans rien dupliquer. Elle n'est pas
 * un client : absente de la liste des clients, du catalogue, des rappels et de la facturation (filtres
 * `kind: "CLIENT"` dans ces services). Ses comptes sont des vendeuses (`SELLER`, `User.merchantId`), qui ne
 * voient que leur boutique.
 *
 * L'entreprise vient toujours de la session (PLA-01) : une boutique d'une autre entreprise est introuvable
 * (404). Chaque création ou modification est journalisée (`AuditLog`, entité « Shop »).
 */
import type { Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "@/services/prisma/client";
import { DomainRuleError } from "@/lib/errors/domain-rule-error";
import type { CreateShopInput, UpdateShopInput } from "@/lib/validations/shop";
import { hashManagerCode } from "@/domains/shop/shop-prices.service";

export type ShopDb = Pick<PrismaClient, "merchant" | "user" | "auditLog" | "deliveryZone">;
const defaultDb = () => prisma as unknown as ShopDb;

export const SHOP_AUDIT_ENTITY = "Shop";

export interface ShopSeller {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  status: string;
}

export interface ShopRow {
  id: string;
  name: string;
  address: string;
  postalCode: string | null;
  city: string | null;
  latitude: number | null;
  longitude: number | null;
  accessInstructions: string | null;
  contactPhone: string | null;
  zoneId: string | null;
  zoneName: string | null;
  active: boolean;
  sellers: ShopSeller[];
}

const notFound = () => new DomainRuleError(404, "Boutique introuvable.", "SHOP_NOT_FOUND");
const noShop = () =>
  new DomainRuleError(403, "Ce compte n'est rattaché à aucune boutique. Contactez l'administrateur.", "SELLER_WITHOUT_SHOP");

const FIELDS = ["name", "address", "postalCode", "city", "latitude", "longitude", "accessInstructions", "contactPhone", "zoneId", "active"] as const;

function snapshot(row: Record<string, unknown>) {
  return Object.fromEntries(FIELDS.map((key) => [key, row[key] ?? null])) as Prisma.InputJsonObject;
}

async function assertZone(db: ShopDb, companyId: string, zoneId: string | null | undefined) {
  if (!zoneId) return;
  const zone = await db.deliveryZone.findFirst({ where: { id: zoneId, companyId } });
  if (!zone) throw new DomainRuleError(400, "Tournée introuvable.", "ZONE_NOT_FOUND");
}

interface ShopRecord {
  id: string;
  name: string;
  address: string;
  postalCode: string | null;
  city: string | null;
  latitude: number | null;
  longitude: number | null;
  accessInstructions: string | null;
  contactPhone: string | null;
  zoneId: string | null;
  active: boolean;
}

async function toRows(db: ShopDb, companyId: string, shops: ShopRecord[]): Promise<ShopRow[]> {
  const [sellers, zones] = await Promise.all([
    shops.length
      ? db.user.findMany({
          where: { companyId, merchantId: { in: shops.map((shop) => shop.id) }, role: { systemRole: "SELLER" } },
          select: { id: true, firstName: true, lastName: true, email: true, status: true, merchantId: true },
        })
      : Promise.resolve([]),
    db.deliveryZone.findMany({ where: { companyId }, select: { id: true, name: true } }),
  ]);
  const zoneName = new Map(zones.map((zone) => [zone.id, zone.name]));
  return shops.map((shop) => ({
    id: shop.id,
    name: shop.name,
    address: shop.address,
    postalCode: shop.postalCode,
    city: shop.city,
    latitude: shop.latitude,
    longitude: shop.longitude,
    accessInstructions: shop.accessInstructions,
    contactPhone: shop.contactPhone,
    zoneId: shop.zoneId,
    zoneName: shop.zoneId ? zoneName.get(shop.zoneId) ?? null : null,
    active: shop.active,
    sellers: sellers
      .filter((seller) => seller.merchantId === shop.id)
      .map((seller) => ({ id: seller.id, firstName: seller.firstName, lastName: seller.lastName, email: seller.email, status: seller.status }))
      .sort((a, b) => a.lastName.localeCompare(b.lastName, "fr")),
  }));
}

/** Boutiques de l'entreprise, actives d'abord, par nom. */
export async function listShops(companyId: string, db: ShopDb = defaultDb()): Promise<ShopRow[]> {
  const shops = await db.merchant.findMany({ where: { companyId, kind: "SHOP" } });
  shops.sort((a, b) => Number(b.active) - Number(a.active) || a.name.localeCompare(b.name, "fr"));
  return toRows(db, companyId, shops);
}

export async function getShop(companyId: string, shopId: string, db: ShopDb = defaultDb()): Promise<ShopRow> {
  const shop = await db.merchant.findFirst({ where: { id: shopId, companyId, kind: "SHOP" } });
  if (!shop) throw notFound();
  return (await toRows(db, companyId, [shop]))[0]!;
}

export async function createShop(actor: { companyId: string; userId: string }, input: CreateShopInput, db: ShopDb = defaultDb()): Promise<ShopRow> {
  await assertZone(db, actor.companyId, input.zoneId);
  const created = await db.merchant.create({
    data: {
      companyId: actor.companyId,
      kind: "SHOP",
      name: input.name,
      address: input.address,
      postalCode: input.postalCode ?? null,
      city: input.city ?? null,
      latitude: input.latitude ?? null,
      longitude: input.longitude ?? null,
      accessInstructions: input.accessInstructions ?? null,
      contactPhone: input.contactPhone ?? null,
      zoneId: input.zoneId,
      active: true,
      // Lot 2, demande 4 : le code responsable est créé avec la boutique (empreinte seulement).
      managerCodeHash: hashManagerCode(input.managerCode),
    },
  });
  await db.auditLog.create({
    data: { companyId: actor.companyId, actorId: actor.userId, entityType: SHOP_AUDIT_ENTITY, entityId: created.id, action: "CREATE", after: snapshot(created) },
  });
  return getShop(actor.companyId, created.id, db);
}

export async function updateShop(
  actor: { companyId: string; userId: string },
  shopId: string,
  input: UpdateShopInput,
  db: ShopDb = defaultDb()
): Promise<ShopRow> {
  const before = await db.merchant.findFirst({ where: { id: shopId, companyId: actor.companyId, kind: "SHOP" } });
  if (!before) throw notFound();
  await assertZone(db, actor.companyId, input.zoneId);
  const data: Record<string, unknown> = {};
  for (const key of FIELDS) if (input[key] !== undefined) data[key] = input[key];
  const { count } = await db.merchant.updateMany({ where: { id: shopId, companyId: actor.companyId, kind: "SHOP" }, data });
  if (count === 0) throw notFound();
  const after = await db.merchant.findFirst({ where: { id: shopId, companyId: actor.companyId } });
  const action = input.active === false && before.active ? "DEACTIVATE" : input.active === true && !before.active ? "REACTIVATE" : "UPDATE";
  await db.auditLog.create({
    data: {
      companyId: actor.companyId,
      actorId: actor.userId,
      entityType: SHOP_AUDIT_ENTITY,
      entityId: shopId,
      action,
      before: snapshot(before),
      after: snapshot(after ?? before),
    },
  });
  return getShop(actor.companyId, shopId, db);
}

/**
 * Demande 1, vérification 2 : la boutique d'une vendeuse, et seulement la sienne. Un compte sans boutique,
 * ou rattaché à autre chose qu'une boutique de son entreprise : refusé (403).
 */
export async function getSellerShop(actor: { companyId: string; merchantId: string | null }, db: ShopDb = defaultDb()): Promise<ShopRow> {
  if (!actor.merchantId) throw noShop();
  const shop = await db.merchant.findFirst({ where: { id: actor.merchantId, companyId: actor.companyId, kind: "SHOP" } });
  if (!shop) throw noShop();
  return (await toRows(db, actor.companyId, [shop]))[0]!;
}
