/**
 * Catalogue de l'entreprise (CAT-1) : catégories ordonnées et désactivables, produits, photos et
 * prix spécifiques par client (ADM-02, ADM-03, RG-05, PLA-04).
 *
 * Toute lecture et toute écriture est bornée à `companyId` (PLA-01, critère 10) : un identifiant
 * d'une autre entreprise est traité comme introuvable (404), jamais comme interdit, pour ne rien
 * révéler de son existence. Seul l'administrateur appelle les écritures (garde des routes).
 */
import { Prisma, type PrismaClient } from "@prisma/client";
import { prisma } from "@/services/prisma/client";
import { DomainRuleError } from "@/lib/errors/domain-rule-error";
import { fr } from "@/lib/i18n/fr";
import {
  deleteProductPhotoFile,
  downloadProductPhoto,
  isProductPhotoPath,
  normalizeProductPhoto,
  uploadProductPhoto,
} from "@/lib/storage/product-photo";
import type {
  CreateCategoryInput,
  CreateProductInput,
  UpdateCategoryInput,
  UpdateProductInput,
  UpsertMerchantPriceInput,
} from "@/lib/validations/catalog";
import type { CategoryRow, MerchantPriceRow, ProductRow, ProductSizeRow } from "./catalog.types";
import { allergenColumns, productAllergens } from "@/domains/catalog/allergens";

export type { CategoryRow, MerchantPriceRow, ProductRow, ProductSizeRow };

export type CatalogDb = Pick<PrismaClient, "category" | "product" | "productSize" | "merchantPrice" | "merchant" | "$transaction">;

const t = fr.catalog.errors;

function isUniqueViolation(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

// ---------------------------------------------------------------------------
// Catégories
// ---------------------------------------------------------------------------


export async function listCategories(companyId: string, db: CatalogDb = prisma): Promise<CategoryRow[]> {
  const rows = await db.category.findMany({
    where: { companyId },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: { id: true, name: true, sortOrder: true, active: true, family: true, _count: { select: { products: true } } },
  });
  return rows.map(({ _count, ...row }) => ({ ...row, productCount: _count.products }));
}

export async function createCategory(companyId: string, input: CreateCategoryInput, db: CatalogDb = prisma) {
  const last = await db.category.findFirst({ where: { companyId }, orderBy: { sortOrder: "desc" }, select: { sortOrder: true } });
  try {
    return await db.category.create({
      data: { companyId, name: input.name, sortOrder: (last?.sortOrder ?? -1) + 1, ...(input.family ? { family: input.family } : {}) },
      select: { id: true, name: true, sortOrder: true, active: true, family: true },
    });
  } catch (error) {
    if (isUniqueViolation(error)) throw new DomainRuleError(409, t.categoryNameTaken, "CATEGORY_NAME_TAKEN");
    throw error;
  }
}

export async function updateCategory(companyId: string, categoryId: string, input: UpdateCategoryInput, db: CatalogDb = prisma) {
  const existing = await db.category.findFirst({ where: { id: categoryId, companyId }, select: { id: true } });
  if (!existing) throw new DomainRuleError(404, t.categoryNotFound, "CATEGORY_NOT_FOUND");
  try {
    return await db.category.update({
      where: { id: existing.id },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.active !== undefined ? { active: input.active } : {}),
        ...(input.family !== undefined ? { family: input.family } : {}),
      },
      select: { id: true, name: true, sortOrder: true, active: true, family: true },
    });
  } catch (error) {
    if (isUniqueViolation(error)) throw new DomainRuleError(409, t.categoryNameTaken, "CATEGORY_NAME_TAKEN");
    throw error;
  }
}

/** Nouvel ordre d'affichage : la liste doit contenir exactement les catégories de l'entreprise. */
export async function reorderCategories(companyId: string, ids: readonly string[], db: CatalogDb = prisma) {
  const current = await db.category.findMany({ where: { companyId }, select: { id: true } });
  const known = new Set(current.map((row) => row.id));
  if (new Set(ids).size !== ids.length || ids.length !== known.size || ids.some((id) => !known.has(id))) {
    throw new DomainRuleError(409, t.reorderMismatch, "CATEGORY_LIST_CHANGED");
  }
  await db.$transaction(
    ids.map((id, index) => db.category.updateMany({ where: { id, companyId }, data: { sortOrder: index } }))
  );
  return listCategories(companyId, db);
}

// ---------------------------------------------------------------------------
// Produits
// ---------------------------------------------------------------------------

const productSelect = {
  id: true,
  name: true,
  description: true,
  categoryId: true,
  unit: true,
  basePriceCents: true,
  vatRateBasisPoints: true,
  sortOrder: true,
  active: true,
  photoUrl: true,
  allergens: true,
  allergensDeclared: true,
  pastryFormat: true,
  recipe: true,
  shelfLifeDays: true,
  category: { select: { name: true, active: true, family: true } },
  _count: { select: { merchantPrices: true } },
} satisfies Prisma.ProductSelect;

type ProductRecord = Prisma.ProductGetPayload<{ select: typeof productSelect }>;


function toProductRow(companyId: string, row: ProductRecord, sizeRows: ReadonlyArray<ProductSizeRow & { productId: string }> = []): ProductRow {
  const hasPhoto = isProductPhotoPath(row.photoUrl, companyId);
  const sizes = sizeRows
    .filter((size) => size.productId === row.id)
    .map((size) => ({ id: size.id, servings: size.servings, restaurantPriceCents: size.restaurantPriceCents }))
    .sort((a, b) => a.servings - b.servings);
  const large = row.pastryFormat === "LARGE";
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    categoryId: row.categoryId,
    categoryName: row.category.name,
    categoryActive: row.category.active,
    unit: row.unit,
    basePriceCents: row.basePriceCents,
    vatRateBasisPoints: row.vatRateBasisPoints,
    active: row.active,
    hasPhoto,
    photoVersion: hasPhoto ? photoVersion(row.photoUrl!) : null,
    specificPriceCount: row._count.merchantPrices,
    allergens: productAllergens(row),
    family: row.category.family,
    pastryFormat: row.pastryFormat,
    recipe: row.recipe,
    shelfLifeDays: row.shelfLifeDays,
    sizes,
    // Lot 2, demande 4 : liste « Produits sans prix » de l'administrateur.
    missingRestaurantPrice: large ? sizes.length === 0 || sizes.some((size) => size.restaurantPriceCents === null) : row.basePriceCents === null,
  };
}

async function loadSizes(db: Pick<CatalogDb, "productSize">, companyId: string, productIds: readonly string[]) {
  if (productIds.length === 0) return [];
  return db.productSize.findMany({
    where: { companyId, productId: { in: [...productIds] } },
    select: { id: true, productId: true, servings: true, restaurantPriceCents: true },
  });
}

/** Fiche à jour d'un produit de l'entreprise, avec ses tailles. */
export async function getProductRow(companyId: string, productId: string, db: CatalogDb = prisma): Promise<ProductRow> {
  const row = await db.product.findFirst({ where: { id: productId, companyId }, select: productSelect });
  if (!row) throw new DomainRuleError(404, t.productNotFound, "PRODUCT_NOT_FOUND");
  return toProductRow(companyId, row, await loadSizes(db, companyId, [row.id]));
}

/**
 * Lot 2, demande 3 : tailles d'un gros gâteau. Une taille gardée (même nombre de parts) garde son prix restaurant,
 * sauf si `restaurantPriceCents` est donné (administrateur) ; une taille retirée disparaît avec ses prix boutique.
 */
export async function syncSizes(
  db: Pick<CatalogDb, "productSize">,
  companyId: string,
  productId: string,
  wanted: ReadonlyArray<{ servings: number; restaurantPriceCents?: number | null }>
) {
  const current = await db.productSize.findMany({ where: { companyId, productId }, select: { id: true, servings: true } });
  const keep = new Set(wanted.map((size) => size.servings));
  const removed = current.filter((size) => !keep.has(size.servings)).map((size) => size.id);
  if (removed.length) await db.productSize.deleteMany({ where: { companyId, id: { in: removed } } });
  for (const size of wanted) {
    const existing = current.find((row) => row.servings === size.servings);
    if (existing) {
      if (size.restaurantPriceCents !== undefined) {
        await db.productSize.update({ where: { id: existing.id }, data: { restaurantPriceCents: size.restaurantPriceCents } });
      }
    } else {
      await db.productSize.create({
        data: { companyId, productId, servings: size.servings, restaurantPriceCents: size.restaurantPriceCents ?? null },
      });
    }
  }
}

/** Partie aléatoire du nom de fichier : change à chaque nouvelle photo. */
export function photoVersion(path: string): string {
  return path.slice(-41, -5).replace(/-/g, "").slice(0, 12);
}

/** Produits de l'entreprise ; `family` (lot 2) : seulement le pain ou seulement la pâtisserie. */
export async function listProducts(companyId: string, db: CatalogDb = prisma, family?: "BREAD" | "PASTRY"): Promise<ProductRow[]> {
  const rows = await db.product.findMany({
    where: { companyId },
    orderBy: [{ category: { sortOrder: "asc" } }, { sortOrder: "asc" }, { name: "asc" }],
    select: productSelect,
  });
  const kept = family ? rows.filter((row) => row.category.family === family) : rows;
  const sizes = await loadSizes(db, companyId, kept.map((row) => row.id));
  return kept.map((row) => toProductRow(companyId, row, sizes));
}

async function assertCategoryInCompany(companyId: string, categoryId: string, db: CatalogDb) {
  const category = await db.category.findFirst({ where: { id: categoryId, companyId }, select: { id: true } });
  if (!category) throw new DomainRuleError(404, t.categoryNotFound, "CATEGORY_NOT_FOUND");
}

export async function createProduct(companyId: string, input: CreateProductInput, db: CatalogDb = prisma): Promise<ProductRow> {
  await assertCategoryInCompany(companyId, input.categoryId, db);
  const last = await db.product.findFirst({
    where: { companyId, categoryId: input.categoryId },
    orderBy: { sortOrder: "desc" },
    select: { sortOrder: true },
  });
  try {
    const row = await db.product.create({
      data: {
        companyId,
        categoryId: input.categoryId,
        name: input.name,
        description: input.description ?? null,
        unit: input.unit,
        basePriceCents: input.basePriceCents,
        vatRateBasisPoints: input.vatRateBasisPoints,
        active: input.active,
        sortOrder: (last?.sortOrder ?? -1) + 1,
        ...(input.allergens !== undefined ? allergenColumns(input.allergens) : {}),
        pastryFormat: input.pastryFormat ?? null,
        recipe: input.recipe ?? null,
        ...(input.shelfLifeDays !== undefined ? { shelfLifeDays: input.shelfLifeDays } : {}),
      },
      select: productSelect,
    });
    if (input.pastryFormat === "LARGE" && input.sizes) await syncSizes(db, companyId, row.id, input.sizes);
    return getProductRow(companyId, row.id, db);
  } catch (error) {
    if (isUniqueViolation(error)) throw new DomainRuleError(409, t.productNameTaken, "PRODUCT_NAME_TAKEN");
    throw error;
  }
}

async function findProductInCompany(companyId: string, productId: string, db: CatalogDb) {
  const product = await db.product.findFirst({ where: { id: productId, companyId }, select: { id: true, photoUrl: true } });
  if (!product) throw new DomainRuleError(404, t.productNotFound, "PRODUCT_NOT_FOUND");
  return product;
}

export async function updateProduct(
  companyId: string,
  productId: string,
  input: UpdateProductInput,
  db: CatalogDb = prisma
): Promise<ProductRow> {
  const product = await findProductInCompany(companyId, productId, db);
  if (input.categoryId) await assertCategoryInCompany(companyId, input.categoryId, db);
  try {
    const row = await db.product.update({
      where: { id: product.id },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.description !== undefined ? { description: input.description } : {}),
        ...(input.categoryId !== undefined ? { categoryId: input.categoryId } : {}),
        ...(input.unit !== undefined ? { unit: input.unit } : {}),
        ...(input.basePriceCents !== undefined ? { basePriceCents: input.basePriceCents } : {}),
        ...(input.vatRateBasisPoints !== undefined ? { vatRateBasisPoints: input.vatRateBasisPoints } : {}),
        ...(input.active !== undefined ? { active: input.active } : {}),
        ...(input.allergens !== undefined ? allergenColumns(input.allergens) : {}),
        ...(input.pastryFormat !== undefined ? { pastryFormat: input.pastryFormat } : {}),
        ...(input.recipe !== undefined ? { recipe: input.recipe } : {}),
        ...(input.shelfLifeDays !== undefined ? { shelfLifeDays: input.shelfLifeDays } : {}),
      },
      select: productSelect,
    });
    // Un produit qui n'est plus un gros gâteau perd ses tailles.
    if (input.sizes !== undefined || input.pastryFormat !== undefined) {
      if (row.pastryFormat !== "LARGE") await syncSizes(db, companyId, row.id, []);
      else if (input.sizes !== undefined) await syncSizes(db, companyId, row.id, input.sizes);
    }
    return getProductRow(companyId, row.id, db);
  } catch (error) {
    if (isUniqueViolation(error)) throw new DomainRuleError(409, t.productNameTaken, "PRODUCT_NAME_TAKEN");
    throw error;
  }
}

// ---------------------------------------------------------------------------
// Photos
// ---------------------------------------------------------------------------

export async function setProductPhoto(companyId: string, productId: string, bytes: Buffer, db: CatalogDb = prisma) {
  const product = await findProductInCompany(companyId, productId, db);
  const webp = await normalizeProductPhoto(bytes);
  const path = await uploadProductPhoto(companyId, product.id, webp);
  try {
    await db.product.update({ where: { id: product.id }, data: { photoUrl: path } });
  } catch (error) {
    await deleteProductPhotoFile(path, companyId).catch(() => undefined);
    throw error;
  }
  if (isProductPhotoPath(product.photoUrl, companyId) && product.photoUrl !== path) {
    await deleteProductPhotoFile(product.photoUrl, companyId).catch((error) =>
      console.warn("[product-photo] Ancienne photo non supprimée", error)
    );
  }
  return { photoVersion: photoVersion(path) };
}

export async function removeProductPhoto(companyId: string, productId: string, db: CatalogDb = prisma) {
  const product = await findProductInCompany(companyId, productId, db);
  if (!product.photoUrl) return;
  await db.product.update({ where: { id: product.id }, data: { photoUrl: null } });
  if (isProductPhotoPath(product.photoUrl, companyId)) {
    await deleteProductPhotoFile(product.photoUrl, companyId).catch((error) =>
      console.warn("[product-photo] Photo retirée mais fichier non supprimé", error)
    );
  }
}

/** Octets WebP de la photo d'un produit de l'entreprise, ou null. */
export async function readProductPhoto(companyId: string, productId: string, db: CatalogDb = prisma): Promise<Buffer | null> {
  const product = await db.product.findFirst({ where: { id: productId, companyId }, select: { photoUrl: true } });
  return product?.photoUrl ? downloadProductPhoto(product.photoUrl, companyId) : null;
}

// ---------------------------------------------------------------------------
// Prix spécifiques (ADM-03, RG-05)
// ---------------------------------------------------------------------------


export async function listMerchantPrices(
  companyId: string,
  filter: { productId?: string; merchantId?: string },
  db: CatalogDb = prisma
): Promise<MerchantPriceRow[]> {
  const rows = await db.merchantPrice.findMany({
    where: { companyId, ...(filter.productId ? { productId: filter.productId } : {}), ...(filter.merchantId ? { merchantId: filter.merchantId } : {}) },
    orderBy: [{ merchant: { name: "asc" } }, { product: { name: "asc" } }],
    select: {
      id: true,
      merchantId: true,
      productId: true,
      priceCents: true,
      merchant: { select: { name: true, tradeName: true } },
      product: { select: { name: true, basePriceCents: true } },
    },
  });
  return rows.map((row) => ({
    id: row.id,
    merchantId: row.merchantId,
    merchantName: row.merchant.tradeName || row.merchant.name,
    productId: row.productId,
    productName: row.product.name,
    priceCents: row.priceCents,
    basePriceCents: row.product.basePriceCents,
  }));
}

/** Crée ou remplace le prix spécifique d'un client pour un produit (une seule ligne par couple). */
export async function upsertMerchantPrice(companyId: string, input: UpsertMerchantPriceInput, db: CatalogDb = prisma) {
  const [merchant, product] = await Promise.all([
    db.merchant.findFirst({ where: { id: input.merchantId, companyId }, select: { id: true } }),
    db.product.findFirst({ where: { id: input.productId, companyId }, select: { id: true } }),
  ]);
  if (!merchant) throw new DomainRuleError(404, t.merchantNotFound, "MERCHANT_NOT_FOUND");
  if (!product) throw new DomainRuleError(404, t.productNotFound, "PRODUCT_NOT_FOUND");
  return db.merchantPrice.upsert({
    where: { merchantId_productId: { merchantId: merchant.id, productId: product.id } },
    update: { priceCents: input.priceCents },
    create: { companyId, merchantId: merchant.id, productId: product.id, priceCents: input.priceCents },
    select: { id: true, merchantId: true, productId: true, priceCents: true },
  });
}

export async function deleteMerchantPrice(companyId: string, priceId: string, db: CatalogDb = prisma) {
  const result = await db.merchantPrice.deleteMany({ where: { id: priceId, companyId } });
  if (result.count === 0) throw new DomainRuleError(404, t.priceNotFound, "PRICE_NOT_FOUND");
}

/** Clients de l'entreprise, pour choisir à qui donner un prix spécifique. */
export async function listMerchantChoices(companyId: string, db: CatalogDb = prisma) {
  const rows = await db.merchant.findMany({
    where: { companyId, kind: "CLIENT" },
    orderBy: { name: "asc" },
    select: { id: true, name: true, tradeName: true, active: true },
  });
  return rows.map((row) => ({ id: row.id, name: row.tradeName || row.name, legalName: row.name, active: row.active }));
}
