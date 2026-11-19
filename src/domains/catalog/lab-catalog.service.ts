/**
 * Lot 2, demande 3 — produits vus du laboratoire.
 *
 * - Le pâtissier crée et modifie les pâtisseries (catégories de famille « PASTRY ») : nom, description, unité,
 *   petite pièce ou gros gâteau et ses tailles en parts, allergènes, recette, durée de vente. Il ne saisit
 *   jamais de prix : un produit qu'il crée n'a pas de prix restaurant (« Produits sans prix » de
 *   l'administrateur, absent du catalogue des restaurants) ni de prix boutique (« Nouveau produit, prix à
 *   saisir » sur chaque tablette). Une taille gardée garde ses prix ; il voit les prix sans les modifier.
 * - Le boulanger règle la durée de vente du pain (catégories « BREAD »), rien d'autre.
 *
 * Tout est borné à l'entreprise de la session (PLA-01) : un produit d'une autre entreprise, ou de l'autre
 * famille, est introuvable (404).
 */
import { Prisma } from "@prisma/client";
import { prisma } from "@/services/prisma/client";
import { DomainRuleError } from "@/lib/errors/domain-rule-error";
import { allergenColumns } from "@/domains/catalog/allergens";
import { assertSizesRemovable, getProductRow, listProducts, syncSizes, type CatalogDb, type ProductRow } from "@/domains/catalog/catalog.service";
import type { CreatePastryProductInput, UpdatePastryProductInput } from "@/lib/validations/catalog";

/** TVA par défaut d'une pâtisserie créée par le pâtissier (vente à emporter, 5,5 %) ; l'administrateur peut la changer. */
const PASTRY_DEFAULT_VAT = 550;

export type LabFamily = "BREAD" | "PASTRY";

const notFound = () => new DomainRuleError(404, "Produit introuvable.", "PRODUCT_NOT_FOUND");
const wrongCategory = () => new DomainRuleError(400, "Choisissez une catégorie de pâtisserie.", "CATEGORY_NOT_PASTRY");

async function assertFamilyCategory(db: CatalogDb, companyId: string, categoryId: string, family: LabFamily) {
  const category = await db.category.findFirst({ where: { id: categoryId, companyId }, select: { family: true } });
  if (!category || category.family !== family) throw wrongCategory();
}

async function assertFamilyProduct(db: CatalogDb, companyId: string, productId: string, family: LabFamily) {
  const product = await db.product.findFirst({ where: { id: productId, companyId }, select: { id: true, categoryId: true } });
  if (!product) throw notFound();
  const category = await db.category.findFirst({ where: { id: product.categoryId, companyId }, select: { family: true } });
  if (category?.family !== family) throw notFound();
  return product;
}

/** Produits d'une famille, avec recette et prix (lecture seule des prix pour le pâtissier). */
export function listLabProducts(companyId: string, family: LabFamily, db: CatalogDb = prisma): Promise<ProductRow[]> {
  return listProducts(companyId, db, family);
}

function isUniqueViolation(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

const nameTaken = () => new DomainRuleError(409, "Un produit porte déjà ce nom.", "PRODUCT_NAME_TAKEN");

/** Demande 3, vérification 1 : le pâtissier crée une pâtisserie, sans aucun prix. */
export async function createPastryProduct(companyId: string, input: CreatePastryProductInput, db: CatalogDb = prisma): Promise<ProductRow> {
  await assertFamilyCategory(db, companyId, input.categoryId, "PASTRY");
  const last = await db.product.findFirst({
    where: { companyId, categoryId: input.categoryId },
    orderBy: { sortOrder: "desc" },
    select: { sortOrder: true },
  });
  let id: string;
  try {
    const created = await db.product.create({
      data: {
        companyId,
        categoryId: input.categoryId,
        name: input.name,
        description: input.description ?? null,
        unit: input.unit,
        basePriceCents: null,
        vatRateBasisPoints: PASTRY_DEFAULT_VAT,
        active: input.active ?? true,
        sortOrder: (last?.sortOrder ?? -1) + 1,
        pastryFormat: input.pastryFormat,
        recipe: input.recipe ?? null,
        shelfLifeDays: input.shelfLifeDays,
        ...(input.allergens !== undefined ? allergenColumns(input.allergens) : {}),
      },
      select: { id: true },
    });
    id = created.id;
  } catch (error) {
    if (isUniqueViolation(error)) throw nameTaken();
    throw error;
  }
  if (input.pastryFormat === "LARGE") await syncSizes(db, companyId, id, (input.servings ?? []).map((servings) => ({ servings })));
  return getProductRow(companyId, id, db);
}

/** Demande 3 : le pâtissier modifie une pâtisserie ; les prix restent ceux de l'administrateur et des boutiques. */
export async function updatePastryProduct(
  companyId: string,
  productId: string,
  input: UpdatePastryProductInput,
  db: CatalogDb = prisma
): Promise<ProductRow> {
  const product = await assertFamilyProduct(db, companyId, productId, "PASTRY");
  if (input.categoryId && input.categoryId !== product.categoryId) await assertFamilyCategory(db, companyId, input.categoryId, "PASTRY");
  if (input.pastryFormat === "SMALL") await assertSizesRemovable(db, companyId, product.id, []);
  else if (input.servings !== undefined) await assertSizesRemovable(db, companyId, product.id, input.servings);
  let format: "SMALL" | "LARGE" | null;
  try {
    const row = await db.product.update({
      where: { id: product.id },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.description !== undefined ? { description: input.description } : {}),
        ...(input.categoryId !== undefined ? { categoryId: input.categoryId } : {}),
        ...(input.unit !== undefined ? { unit: input.unit } : {}),
        ...(input.pastryFormat !== undefined ? { pastryFormat: input.pastryFormat } : {}),
        ...(input.recipe !== undefined ? { recipe: input.recipe } : {}),
        ...(input.shelfLifeDays !== undefined ? { shelfLifeDays: input.shelfLifeDays } : {}),
        ...(input.active !== undefined ? { active: input.active } : {}),
        ...(input.allergens !== undefined ? allergenColumns(input.allergens) : {}),
      },
      select: { pastryFormat: true },
    });
    format = row.pastryFormat;
  } catch (error) {
    if (isUniqueViolation(error)) throw nameTaken();
    throw error;
  }
  if (format !== "LARGE") await syncSizes(db, companyId, product.id, []);
  else if (input.servings !== undefined) await syncSizes(db, companyId, product.id, input.servings.map((servings) => ({ servings })));
  return getProductRow(companyId, product.id, db);
}

/** Demande 3 : le boulanger règle la durée de vente d'un pain (et rien d'autre). */
export async function updateBreadShelfLife(companyId: string, productId: string, shelfLifeDays: number, db: CatalogDb = prisma): Promise<ProductRow> {
  const product = await assertFamilyProduct(db, companyId, productId, "BREAD");
  await db.product.update({ where: { id: product.id }, data: { shelfLifeDays } });
  return getProductRow(companyId, product.id, db);
}

/**
 * Lot 2, demande 3, règle : la recette n'est lue que par les pâtissiers, l'administrateur et le
 * super-administrateur. Le boulanger reçoit la liste du pain sans recette.
 */
export function withoutRecipe(rows: readonly ProductRow[]): ProductRow[] {
  return rows.map((row) => ({ ...row, recipe: null }));
}
