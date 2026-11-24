/**
 * Lot 2, demande 4 — prix boutique et code responsable.
 *
 * Chaque boutique a ses propres prix (`ShopPrice`, un par produit, et par taille pour un gros gâteau). Ils se
 * règlent :
 * - sur la tablette, dans Paramètres › « Produits et prix », par la responsable, avec le **code responsable** ;
 * - ou par l'administrateur depuis son espace, sans code. Le changement se lit aussitôt sur la tablette, qui
 *   relit les prix à chaque ouverture.
 *
 * Un produit actif sans ligne pour la boutique apparaît comme « Nouveau produit, prix à saisir ». La responsable
 * peut aussi le marquer « non vendu » (`sold: false`). Un produit sans prix boutique peut être reçu et suivi en
 * stock, mais pas choisi dans une commande de particulier (demande 9).
 *
 * Le code n'est jamais rangé en clair : seulement une empreinte scrypt salée, comparée en temps constant. Après
 * 5 essais manqués d'affilée, la rubrique est bloquée 15 minutes. L'administrateur crée le code avec la
 * boutique et peut le réinitialiser ; la responsable le change en donnant l'ancien. Chaque changement de prix
 * et de code est journalisé (entités « ShopPrice » et « ShopManagerCode », sans jamais le code).
 */
import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import type { Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "@/services/prisma/client";
import { DomainRuleError } from "@/lib/errors/domain-rule-error";

export type ShopPricesDb = Pick<PrismaClient, "merchant" | "product" | "productSize" | "shopPrice" | "auditLog" | "category" | "$transaction">;
const defaultDb = () => prisma as unknown as ShopPricesDb;

export const MANAGER_CODE_MAX_FAILURES = 5;
export const MANAGER_CODE_LOCK_MS = 15 * 60 * 1000;

export type ShopPriceStatus = "NEW" | "SOLD" | "NOT_SOLD";

export interface ShopPriceEntry {
  productId: string;
  productName: string;
  categoryName: string;
  family: "BREAD" | "PASTRY";
  unit: string;
  /** Gros gâteau : la taille ; sinon vide. */
  sizeId: string | null;
  servings: number | null;
  /** NEW : « Nouveau produit, prix à saisir » ; SOLD : vendu à ce prix ; NOT_SOLD : pas vendu dans cette boutique. */
  status: ShopPriceStatus;
  /** Prix TTC payé par le particulier, en centimes. */
  priceCents: number | null;
}

export interface ShopPriceBoard {
  shopId: string;
  shopName: string;
  entries: ShopPriceEntry[];
  newCount: number;
}

export interface ShopPriceInput {
  productId: string;
  sizeId: string | null;
  sold: boolean;
  priceCents: number | null;
}

const shopNotFound = () => new DomainRuleError(404, "Point de vente introuvable.", "SHOP_NOT_FOUND");

// ---------------------------------------------------------------------------
// Code responsable
// ---------------------------------------------------------------------------

/** Empreinte « sel:empreinte » (scrypt, sel aléatoire de 16 octets). */
export function hashManagerCode(code: string): string {
  const salt = randomBytes(16).toString("hex");
  return `${salt}:${scryptSync(code, salt, 32).toString("hex")}`;
}

export function managerCodeMatches(code: string, stored: string | null): boolean {
  if (!stored) return false;
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const expected = Buffer.from(hash, "hex");
  const actual = scryptSync(code, salt, expected.length);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

async function findShop(db: ShopPricesDb, companyId: string, shopId: string) {
  const shop = await db.merchant.findFirst({
    where: { id: shopId, companyId, kind: "SHOP" },
    select: { id: true, name: true, managerCodeHash: true, managerCodeFailures: true, managerCodeLockedUntil: true },
  });
  if (!shop) throw shopNotFound();
  return shop;
}

/**
 * Demande 4, vérification 2 : sans le bon code, « Produits et prix » ne s'ouvre pas. Trop d'essais manqués :
 * blocage temporaire (429), même avec le bon code.
 */
export async function verifyManagerCode(db: ShopPricesDb, companyId: string, shopId: string, code: string, now = new Date()) {
  const shop = await findShop(db, companyId, shopId);
  if (shop.managerCodeLockedUntil && shop.managerCodeLockedUntil > now) {
    throw new DomainRuleError(429, "Trop d'essais : « Produits et prix » est bloqué 15 minutes. L'administrateur peut réinitialiser le code.", "MANAGER_CODE_LOCKED");
  }
  if (!shop.managerCodeHash) {
    throw new DomainRuleError(403, "Aucun code responsable pour ce point de vente : demandez-le à l'administrateur.", "MANAGER_CODE_MISSING");
  }
  if (!managerCodeMatches(code, shop.managerCodeHash)) {
    // Relecture d'Orso (19 novembre) : incrément atomique, des essais simultanés ne se perdent pas.
    const counted = await db.merchant.update({ where: { id: shop.id }, data: { managerCodeFailures: { increment: 1 } }, select: { managerCodeFailures: true } });
    if (counted.managerCodeFailures >= MANAGER_CODE_MAX_FAILURES) {
      await db.merchant.update({ where: { id: shop.id }, data: { managerCodeFailures: 0, managerCodeLockedUntil: new Date(now.getTime() + MANAGER_CODE_LOCK_MS) } });
    }
    throw new DomainRuleError(403, "Code responsable incorrect.", "MANAGER_CODE_WRONG");
  }
  if (shop.managerCodeFailures > 0 || shop.managerCodeLockedUntil) {
    await db.merchant.update({ where: { id: shop.id }, data: { managerCodeFailures: 0, managerCodeLockedUntil: null } });
  }
  return shop;
}

/** Création ou réinitialisation par l'administrateur (demande 4, règle « code oublié »). */
export async function setManagerCode(db: ShopPricesDb, actor: { companyId: string; userId: string }, shopId: string, code: string) {
  const shop = await findShop(db, actor.companyId, shopId);
  await db.merchant.update({
    where: { id: shop.id },
    data: { managerCodeHash: hashManagerCode(code), managerCodeFailures: 0, managerCodeLockedUntil: null },
  });
  await db.auditLog.create({
    data: { companyId: actor.companyId, actorId: actor.userId, entityType: "ShopManagerCode", entityId: shop.id, action: shop.managerCodeHash ? "RESET" : "CREATE" },
  });
}

/** La responsable change son code en donnant l'ancien. */
export async function changeManagerCode(
  db: ShopPricesDb,
  actor: { companyId: string; userId: string; shopId: string },
  currentCode: string,
  newCode: string,
  now = new Date()
) {
  await verifyManagerCode(db, actor.companyId, actor.shopId, currentCode, now);
  await db.merchant.update({ where: { id: actor.shopId }, data: { managerCodeHash: hashManagerCode(newCode) } });
  await db.auditLog.create({
    data: { companyId: actor.companyId, actorId: actor.userId, entityType: "ShopManagerCode", entityId: actor.shopId, action: "CHANGE" },
  });
}

// ---------------------------------------------------------------------------
// Prix boutique
// ---------------------------------------------------------------------------

/**
 * Tous les produits actifs de l'entreprise (pain et pâtisserie, une ligne par taille d'un gros gâteau) avec leur
 * prix dans la boutique. Les nouveaux produits (sans ligne) viennent en premier.
 */
export async function getShopPriceBoard(companyId: string, shopId: string, db: ShopPricesDb = defaultDb()): Promise<ShopPriceBoard> {
  const shop = await findShop(db, companyId, shopId);
  const [products, categories, sizes, prices] = await Promise.all([
    db.product.findMany({
      where: { companyId, active: true },
      select: { id: true, name: true, unit: true, categoryId: true, sortOrder: true, pastryFormat: true },
    }),
    db.category.findMany({ where: { companyId }, select: { id: true, name: true, sortOrder: true, active: true, family: true } }),
    db.productSize.findMany({ where: { companyId }, select: { id: true, productId: true, servings: true } }),
    db.shopPrice.findMany({ where: { companyId, shopId: shop.id }, select: { productId: true, sizeKey: true, sold: true, priceCents: true } }),
  ]);
  const categoryById = new Map(categories.map((category) => [category.id, category]));
  const priceByKey = new Map(prices.map((price) => [`${price.productId}|${price.sizeKey}`, price]));
  const entries: Array<ShopPriceEntry & { order: [number, number] }> = [];
  for (const product of products) {
    const category = categoryById.get(product.categoryId);
    if (!category?.active) continue;
    const variants =
      product.pastryFormat === "LARGE"
        ? sizes.filter((size) => size.productId === product.id).sort((a, b) => a.servings - b.servings).map((size) => ({ sizeId: size.id, servings: size.servings }))
        : [{ sizeId: null, servings: null }];
    for (const variant of variants) {
      const price = priceByKey.get(`${product.id}|${variant.sizeId ?? ""}`);
      entries.push({
        productId: product.id,
        productName: product.name,
        categoryName: category.name,
        family: category.family,
        unit: product.unit,
        sizeId: variant.sizeId,
        servings: variant.servings,
        status: !price ? "NEW" : price.sold ? "SOLD" : "NOT_SOLD",
        priceCents: price?.sold ? price.priceCents : null,
        order: [category.sortOrder, product.sortOrder],
      });
    }
  }
  entries.sort(
    (a, b) =>
      Number(b.status === "NEW") - Number(a.status === "NEW") ||
      a.order[0] - b.order[0] ||
      a.order[1] - b.order[1] ||
      a.productName.localeCompare(b.productName, "fr") ||
      (a.servings ?? 0) - (b.servings ?? 0)
  );
  return {
    shopId: shop.id,
    shopName: shop.name,
    entries: entries.map((entry) => {
      const { order, ...rest } = entry;
      void order;
      return rest;
    }),
    newCount: entries.filter((entry) => entry.status === "NEW").length,
  };
}

/**
 * Enregistre des prix boutique (responsable avec son code, ou administrateur). Un produit vendu a un prix ;
 * un produit non vendu n'en a pas. Produits et tailles doivent appartenir à l'entreprise ; un gros gâteau se
 * règle taille par taille.
 */
export async function setShopPrices(
  db: ShopPricesDb,
  actor: { companyId: string; userId: string },
  shopId: string,
  inputs: readonly ShopPriceInput[]
): Promise<ShopPriceBoard> {
  const shop = await findShop(db, actor.companyId, shopId);
  const productIds = [...new Set(inputs.map((input) => input.productId))];
  const [products, sizes] = await Promise.all([
    db.product.findMany({ where: { companyId: actor.companyId, id: { in: productIds } }, select: { id: true, pastryFormat: true } }),
    db.productSize.findMany({ where: { companyId: actor.companyId, productId: { in: productIds } }, select: { id: true, productId: true } }),
  ]);
  const productById = new Map(products.map((product) => [product.id, product]));
  for (const input of inputs) {
    const product = productById.get(input.productId);
    if (!product) throw new DomainRuleError(404, "Produit introuvable.", "PRODUCT_NOT_FOUND");
    const large = product.pastryFormat === "LARGE";
    if (large && !sizes.some((size) => size.id === input.sizeId && size.productId === product.id)) {
      throw new DomainRuleError(400, "Choisissez une taille de ce produit.", "SIZE_REQUIRED");
    }
    if (!large && input.sizeId !== null) throw new DomainRuleError(400, "Ce produit n'a pas de taille.", "SIZE_NOT_ALLOWED");
    if (input.sold && (input.priceCents === null || input.priceCents <= 0)) {
      throw new DomainRuleError(400, "Saisissez le prix en point de vente, ou marquez le produit « non vendu ».", "SHOP_PRICE_REQUIRED");
    }
  }
  const before = await db.shopPrice.findMany({ where: { companyId: actor.companyId, shopId: shop.id, productId: { in: productIds } } });
  for (const input of inputs) {
    const sizeKey = input.sizeId ?? "";
    const data = { sold: input.sold, priceCents: input.sold ? input.priceCents : null };
    await db.shopPrice.upsert({
      where: { shopId_productId_sizeKey: { shopId: shop.id, productId: input.productId, sizeKey } },
      update: data,
      create: { companyId: actor.companyId, shopId: shop.id, productId: input.productId, sizeId: input.sizeId, sizeKey, ...data },
    });
  }
  await db.auditLog.create({
    data: {
      companyId: actor.companyId,
      actorId: actor.userId,
      entityType: "ShopPrice",
      entityId: shop.id,
      action: "UPDATE",
      before: before.map((row) => ({ productId: row.productId, sizeKey: row.sizeKey, sold: row.sold, priceCents: row.priceCents })) as Prisma.InputJsonArray,
      after: inputs.map((input) => ({ productId: input.productId, sizeKey: input.sizeId ?? "", sold: input.sold, priceCents: input.sold ? input.priceCents : null })) as Prisma.InputJsonArray,
    },
  });
  return getShopPriceBoard(actor.companyId, shop.id, db);
}

/**
 * Prix boutique d'un produit dans chaque boutique, pour le pâtissier qui les voit sans les modifier
 * (demande 4, règle) et pour l'administrateur.
 */
export async function shopPricesByProduct(companyId: string, productIds: readonly string[], db: ShopPricesDb = defaultDb()) {
  if (productIds.length === 0) return new Map<string, Array<{ shopName: string; sizeId: string | null; priceCents: number }>>();
  const [rows, shops] = await Promise.all([
    db.shopPrice.findMany({ where: { companyId, productId: { in: [...productIds] }, sold: true }, select: { productId: true, shopId: true, sizeId: true, priceCents: true } }),
    db.merchant.findMany({ where: { companyId, kind: "SHOP" }, select: { id: true, name: true } }),
  ]);
  const shopName = new Map(shops.map((shop) => [shop.id, shop.name]));
  const result = new Map<string, Array<{ shopName: string; sizeId: string | null; priceCents: number }>>();
  for (const row of rows) {
    if (row.priceCents === null) continue;
    const list = result.get(row.productId) ?? [];
    list.push({ shopName: shopName.get(row.shopId) ?? "", sizeId: row.sizeId, priceCents: row.priceCents });
    result.set(row.productId, list);
  }
  return result;
}
