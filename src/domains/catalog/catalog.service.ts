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
import type { CategoryRow, MerchantPriceRow, ProductRow } from "./catalog.types";

export type { CategoryRow, MerchantPriceRow, ProductRow };

export type CatalogDb = Pick<PrismaClient, "category" | "product" | "merchantPrice" | "merchant" | "$transaction">;

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
    select: { id: true, name: true, sortOrder: true, active: true, _count: { select: { products: true } } },
  });
  return rows.map(({ _count, ...row }) => ({ ...row, productCount: _count.products }));
}

export async function createCategory(companyId: string, input: CreateCategoryInput, db: CatalogDb = prisma) {
  const last = await db.category.findFirst({ where: { companyId }, orderBy: { sortOrder: "desc" }, select: { sortOrder: true } });
  try {
    return await db.category.create({
      data: { companyId, name: input.name, sortOrder: (last?.sortOrder ?? -1) + 1 },
      select: { id: true, name: true, sortOrder: true, active: true },
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
      data: { ...(input.name !== undefined ? { name: input.name } : {}), ...(input.active !== undefined ? { active: input.active } : {}) },
      select: { id: true, name: true, sortOrder: true, active: true },
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
  category: { select: { name: true, active: true } },
  _count: { select: { merchantPrices: true } },
} satisfies Prisma.ProductSelect;

type ProductRecord = Prisma.ProductGetPayload<{ select: typeof productSelect }>;


function toProductRow(companyId: string, row: ProductRecord): ProductRow {
  const hasPhoto = isProductPhotoPath(row.photoUrl, companyId);
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
  };
}

/** Partie aléatoire du nom de fichier : change à chaque nouvelle photo. */
export function photoVersion(path: string): string {
  return path.slice(-41, -5).replace(/-/g, "").slice(0, 12);
}

export async function listProducts(companyId: string, db: CatalogDb = prisma): Promise<ProductRow[]> {
  const rows = await db.product.findMany({
    where: { companyId },
    orderBy: [{ category: { sortOrder: "asc" } }, { sortOrder: "asc" }, { name: "asc" }],
    select: productSelect,
  });
  return rows.map((row) => toProductRow(companyId, row));
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
      },
      select: productSelect,
    });
    return toProductRow(companyId, row);
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
      },
      select: productSelect,
    });
    return toProductRow(companyId, row);
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
    where: { companyId },
    orderBy: { name: "asc" },
    select: { id: true, name: true, tradeName: true, active: true },
  });
  return rows.map((row) => ({ id: row.id, name: row.tradeName || row.name, legalName: row.name, active: row.active }));
}
