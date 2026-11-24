/**
 * Lot 2, demandes 3 et 4 (18 novembre 2026) : pâtisseries créées par le pâtissier (format, tailles, recette,
 * durée de vente) ; prix restaurant (administrateur) et prix boutique (responsable avec son code, ou
 * administrateur).
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { createPastryProduct, updateBreadShelfLife, updatePastryProduct, withoutRecipe } from "../src/domains/catalog/lab-catalog.service";
import { listProducts, updateProduct, type CatalogDb } from "../src/domains/catalog/catalog.service";
import { applyPrices, resolveUnitPrice } from "../src/domains/catalog/pricing";
import {
  MANAGER_CODE_MAX_FAILURES,
  changeManagerCode,
  getShopPriceBoard,
  hashManagerCode,
  managerCodeMatches,
  setManagerCode,
  setShopPrices,
  verifyManagerCode,
  type ShopPricesDb,
} from "../src/domains/shop/shop-prices.service";
import { createPastryProductSchema, createProductSchema } from "../src/lib/validations/catalog";
import { createShopSchema, sellerShopPricesSchema } from "../src/lib/validations/shop";
import { ROLE_PERMISSIONS } from "../prisma/reference-data";
import { createMemoryDb } from "./helpers/memory-db";

type Row = Record<string, unknown>;

function fixture() {
  const tables: Record<string, Row[]> = {
    category: [
      { id: "catGateaux", companyId: "A", name: "Gâteaux à partager", sortOrder: 0, active: true, family: "PASTRY" },
      { id: "catPain", companyId: "A", name: "Pains", sortOrder: 1, active: true, family: "BREAD" },
      { id: "catB", companyId: "B", name: "Gâteaux B", sortOrder: 0, active: true, family: "PASTRY" },
    ],
    product: [
      { id: "baguette", companyId: "A", categoryId: "catPain", name: "Baguette", unit: "pièce", basePriceCents: 110, vatRateBasisPoints: 550, sortOrder: 0, active: true, shelfLifeDays: 1, pastryFormat: null, recipe: null, allergens: [], allergensDeclared: false, photoUrl: null, description: null },
    ],
    productSize: [],
    merchant: [
      { id: "centre", companyId: "A", kind: "SHOP", name: "Centre-ville", managerCodeHash: hashManagerCode("4821"), managerCodeFailures: 0, managerCodeLockedUntil: null },
      { id: "gare", companyId: "A", kind: "SHOP", name: "Gare", managerCodeHash: hashManagerCode("1111"), managerCodeFailures: 0, managerCodeLockedUntil: null },
      { id: "client1", companyId: "A", kind: "CLIENT", name: "Bistrot" },
    ],
    shopPrice: [],
    merchantPrice: [],
    auditLog: [],
  };
  const db = createMemoryDb(tables, {
    decorate: {
      product: (row, all) => ({
        category: all.category!.find((category) => category.id === row.categoryId),
        _count: { merchantPrices: 0 },
      }),
    },
  });
  return { tables, catalogDb: db as unknown as CatalogDb, pricesDb: db as unknown as ShopPricesDb };
}

const FRAISIER = createPastryProductSchema.parse({
  name: "Fraisier",
  categoryId: "catGateaux",
  unit: "pièce",
  pastryFormat: "LARGE",
  servings: [6, 8, 10],
  recipe: "Génoise, crème mousseline, fraises.",
  shelfLifeDays: 2,
  allergens: ["GLUTEN", "EGGS", "MILK"],
});
const ADMIN = { companyId: "A", userId: "admin" };

test("LOT2-D3 vérification 1 : le pâtissier crée « Fraisier » en produit à tailles (6, 8, 10 personnes), avec recette et 2 jours de vente, sans aucun prix", async () => {
  const { catalogDb } = fixture();
  const fraisier = await createPastryProduct("A", FRAISIER, catalogDb);
  assert.deepEqual([fraisier.pastryFormat, fraisier.shelfLifeDays, fraisier.recipe], ["LARGE", 2, "Génoise, crème mousseline, fraises."]);
  assert.deepEqual(fraisier.sizes.map((size) => [size.servings, size.restaurantPriceCents]), [[6, null], [8, null], [10, null]]);
  assert.equal(fraisier.basePriceCents, null);
  assert.equal(fraisier.missingRestaurantPrice, true);
  // Le pâtissier ne saisit jamais de prix : la fiche n'en accepte pas.
  assert.equal(createPastryProductSchema.safeParse({ ...FRAISIER, basePriceCents: 4000 }).success, false);
  assert.equal(createPastryProductSchema.safeParse({ ...FRAISIER, servings: [] }).success, false, "un produit à tailles a au moins une taille");
  assert.equal(createPastryProductSchema.safeParse({ ...FRAISIER, pastryFormat: "SMALL" }).success, false, "une petite pièce n'a pas de taille");
  // Le pâtissier ne voit que la pâtisserie : pas de création dans le pain, pas de modification d'un pain.
  await assert.rejects(createPastryProduct("A", { ...FRAISIER, name: "Pain pâtissier", categoryId: "catPain" }, catalogDb), { status: 400 });
  await assert.rejects(updatePastryProduct("A", "baguette", { recipe: "x" }, catalogDb), { status: 404 });
  await assert.rejects(createPastryProduct("A", { ...FRAISIER, categoryId: "catB" }, catalogDb), { status: 400 });
});

test("LOT2-D3 vérification 2 : l'administrateur voit le fraisier et le modifie (prix restaurant par taille) ; une taille gardée garde son prix", async () => {
  const { catalogDb } = fixture();
  const fraisier = await createPastryProduct("A", FRAISIER, catalogDb);
  assert.ok((await listProducts("A", catalogDb)).some((product) => product.id === fraisier.id));
  const priced = await updateProduct("A", fraisier.id, createProductSchema.parse({
    name: "Fraisier", categoryId: "catGateaux", unit: "pièce", basePriceCents: null, vatRateBasisPoints: 550, active: true, pastryFormat: "LARGE",
    sizes: [{ servings: 6, restaurantPriceCents: 2400 }, { servings: 8, restaurantPriceCents: 3200 }, { servings: 10, restaurantPriceCents: 4000 }],
  }), catalogDb);
  assert.deepEqual(priced.sizes.map((size) => size.restaurantPriceCents), [2400, 3200, 4000]);
  assert.equal(priced.missingRestaurantPrice, false);
  // Le pâtissier ajoute une taille de 12 : les prix existants restent, la nouvelle est à saisir.
  const again = await updatePastryProduct("A", fraisier.id, { servings: [6, 8, 10, 12] }, catalogDb);
  assert.deepEqual(again.sizes.map((size) => [size.servings, size.restaurantPriceCents]), [[6, 2400], [8, 3200], [10, 4000], [12, null]]);
  assert.equal(again.missingRestaurantPrice, true);
});

test("LOT2-D3 vérification 3 : la recette ne sort jamais vers la vendeuse, le livreur, le client ni le boulanger", async () => {
  const { catalogDb, pricesDb } = fixture();
  await createPastryProduct("A", FRAISIER, catalogDb);
  // Tablette : le tableau des prix boutique ne porte pas la recette.
  const board = await getShopPriceBoard("A", "centre", pricesDb);
  assert.equal(JSON.stringify(board).includes("Génoise"), false);
  // Boulanger : liste du pain sans recette.
  assert.equal(withoutRecipe(await listProducts("A", catalogDb)).every((product) => product.recipe === null), true);
  // Aucune permission de catalogue pour la vendeuse et le livreur ; les routes qui renvoient la recette sont réservées.
  assert.deepEqual([...ROLE_PERMISSIONS.SELLER], ["dashboard:shop"]);
  assert.equal(ROLE_PERMISSIONS.DRIVER.some((permission) => permission.startsWith("catalog:")), false);
  assert.match(readFileSync("src/app/api/catalog/products/route.ts", "utf8"), /requireCompanyAdminAny/);
  assert.match(readFileSync("src/app/api/pastry/products/route.ts", "utf8"), /requireCompanyRole\(\["PASTRY_CHEF"\], "catalog:pastry"\)/);
  assert.match(readFileSync("src/app/api/bakery/products/route.ts", "utf8"), /withoutRecipe/);
  // Catalogue des restaurants : sélection explicite sans la recette.
  const merchantCatalog = readFileSync("src/domains/order/merchant-catalog.service.ts", "utf8");
  assert.doesNotMatch(merchantCatalog, /recipe/);
});

test("LOT2-D3 : le pain a une durée de vente réglée par le boulanger ; il ne touche pas aux pâtisseries", async () => {
  const { catalogDb } = fixture();
  const fraisier = await createPastryProduct("A", FRAISIER, catalogDb);
  assert.equal((await updateBreadShelfLife("A", "baguette", 2, catalogDb)).shelfLifeDays, 2);
  await assert.rejects(updateBreadShelfLife("A", fraisier.id, 5, catalogDb), { status: 404 });
  assert.equal(ROLE_PERMISSIONS.BAKER.includes("catalog:bread"), true);
  assert.equal(ROLE_PERMISSIONS.BAKER.includes("catalog:pastry"), false);
});

test("LOT2-D4 vérifications 1 et 5 : sans prix restaurant, le fraisier est « sans prix » chez l'admin, nouveau sur chaque tablette, absent du catalogue des restaurants", async () => {
  const { catalogDb, pricesDb } = fixture();
  const fraisier = await createPastryProduct("A", FRAISIER, catalogDb);
  assert.deepEqual((await listProducts("A", catalogDb)).filter((product) => product.missingRestaurantPrice).map((product) => product.name), ["Fraisier"]);
  for (const shop of ["centre", "gare"]) {
    const board = await getShopPriceBoard("A", shop, pricesDb);
    const entries = board.entries.filter((entry) => entry.productId === fraisier.id);
    assert.deepEqual(entries.map((entry) => [entry.servings, entry.status]), [[6, "NEW"], [8, "NEW"], [10, "NEW"]], shop);
  }
  // Catalogue des restaurants : un produit sans prix restaurant n'a pas de prix appliqué, même avec un ancien prix spécifique.
  assert.equal(resolveUnitPrice({ basePriceCents: null }, 900), null);
  assert.equal(applyPrices([{ id: "x", basePriceCents: null, vatRateBasisPoints: 550 }], [{ productId: "x", priceCents: 900 }]).has("x"), false);
  const merchantCatalog = readFileSync("src/domains/order/merchant-catalog.service.ts", "utf8");
  assert.match(merchantCatalog, /basePriceCents: \{ not: null \}/);
  assert.match(readFileSync("src/domains/order/merchant-order.service.ts", "utf8"), /row\.basePriceCents !== null && row\.pastryFormat !== "LARGE"/);
});

test("LOT2-D4 vérification 2 : sans le code responsable, « Produits et prix » reste fermé ; trop d'essais bloquent la rubrique", async () => {
  const { tables, pricesDb } = fixture();
  await assert.rejects(verifyManagerCode(pricesDb, "A", "centre", "0000"), { status: 403 });
  const now = new Date("2026-11-19T08:00:00Z");
  for (let attempt = 1; attempt < MANAGER_CODE_MAX_FAILURES; attempt += 1) await assert.rejects(verifyManagerCode(pricesDb, "A", "centre", "0000", now), { status: 403 });
  await assert.rejects(verifyManagerCode(pricesDb, "A", "centre", "4821", now), { status: 429 }, "bloqué même avec le bon code");
  await verifyManagerCode(pricesDb, "A", "centre", "4821", new Date(now.getTime() + 16 * 60 * 1000));
  // Le code n'est jamais rangé en clair.
  const centre = tables.merchant!.find((row) => row.id === "centre")!;
  assert.equal(String(centre.managerCodeHash).includes("4821"), false);
  assert.equal(managerCodeMatches("4821", String(centre.managerCodeHash)), true);
  // La route de la tablette vérifie le code avant de lire ou d'écrire.
  const route = readFileSync("src/app/api/shop/prices/route.ts", "utf8");
  assert.equal((route.match(/await verifyManagerCode\(/g) ?? []).length, 2);
  assert.equal(sellerShopPricesSchema.safeParse({ prices: [{ productId: "p", sizeId: null, sold: true, priceCents: 100 }] }).success, false, "pas d'écriture sans code");
});

test("LOT2-D4 vérifications 3 et 6 : 40 € pour le fraisier 10 personnes à « Centre-ville » seulement ; l'admin passe à 42 €", async () => {
  const { catalogDb, pricesDb, tables } = fixture();
  const fraisier = await createPastryProduct("A", FRAISIER, catalogDb);
  const size10 = fraisier.sizes.find((size) => size.servings === 10)!;
  await verifyManagerCode(pricesDb, "A", "centre", "4821");
  const board = await setShopPrices(pricesDb, { companyId: "A", userId: "vendeuse" }, "centre", [{ productId: fraisier.id, sizeId: size10.id, sold: true, priceCents: 4000 }]);
  const tenCentre = board.entries.find((entry) => entry.productId === fraisier.id && entry.servings === 10)!;
  assert.deepEqual([tenCentre.status, tenCentre.priceCents], ["SOLD", 4000]);
  const tenGare = (await getShopPriceBoard("A", "gare", pricesDb)).entries.find((entry) => entry.productId === fraisier.id && entry.servings === 10)!;
  assert.deepEqual([tenGare.status, tenGare.priceCents], ["NEW", null], "le prix ne vaut que dans sa point de vente");
  // Vérification 6 : l'administrateur, sans code, passe le prix à 42 € ; la tablette relit 42 €.
  await setShopPrices(pricesDb, ADMIN, "centre", [{ productId: fraisier.id, sizeId: size10.id, sold: true, priceCents: 4200 }]);
  assert.equal((await getShopPriceBoard("A", "centre", pricesDb)).entries.find((entry) => entry.sizeId === size10.id)!.priceCents, 4200);
  assert.equal(tables.auditLog!.filter((log) => log.entityType === "ShopPrice").length, 2);
  // Règles : un gros gâteau se règle par taille ; un produit vendu a un prix ; une autre entreprise est introuvable.
  await assert.rejects(setShopPrices(pricesDb, ADMIN, "centre", [{ productId: fraisier.id, sizeId: null, sold: true, priceCents: 4000 }]), { status: 400 });
  await assert.rejects(setShopPrices(pricesDb, ADMIN, "centre", [{ productId: "baguette", sizeId: null, sold: true, priceCents: null }]), { status: 400 });
  await assert.rejects(setShopPrices(pricesDb, { companyId: "B", userId: "x" }, "centre", []), { status: 404 });
  // « Non vendu » : plus de prix, et plus « nouveau ».
  await setShopPrices(pricesDb, ADMIN, "gare", [{ productId: "baguette", sizeId: null, sold: false, priceCents: null }]);
  assert.equal((await getShopPriceBoard("A", "gare", pricesDb)).entries.find((entry) => entry.productId === "baguette")!.status, "NOT_SOLD");
});

test("LOT2-D4 : code créé avec le point de vente, réinitialisé par l'admin, changé par la responsable avec l'ancien", async () => {
  const { tables, pricesDb } = fixture();
  assert.equal(createShopSchema.safeParse({ name: "X", address: "1 rue", zoneId: "z" }).success, false, "code obligatoire à la création");
  assert.equal(createShopSchema.safeParse({ name: "X", address: "1 rue", zoneId: "z", managerCode: "12a4" }).success, false);
  await setManagerCode(pricesDb, ADMIN, "centre", "9999");
  await assert.rejects(verifyManagerCode(pricesDb, "A", "centre", "4821"), { status: 403 });
  await changeManagerCode(pricesDb, { companyId: "A", userId: "vendeuse", shopId: "centre" }, "9999", "2468");
  await verifyManagerCode(pricesDb, "A", "centre", "2468");
  await assert.rejects(changeManagerCode(pricesDb, { companyId: "A", userId: "vendeuse", shopId: "centre" }, "0000", "1357"), { status: 403 });
  const logs = tables.auditLog!.filter((log) => log.entityType === "ShopManagerCode").map((log) => log.action);
  assert.deepEqual(logs, ["RESET", "CHANGE"]);
  assert.equal(JSON.stringify(tables.auditLog).includes("2468"), false, "jamais le code dans le journal");
});
