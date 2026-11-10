/**
 * Lot 1, demande 3 — allergènes sur chaque produit : 14 allergènes réglementaires cochés par
 * l'administrateur, « Aucun allergène » déclaré par un bouton, « Allergènes non renseignés » par défaut.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { ALLERGENS, allergenColumns, allergenSummary, productAllergens } from "../src/domains/catalog/allergens";
import { createProduct, updateProduct, type CatalogDb } from "../src/domains/catalog/catalog.service";
import { createProductSchema, updateProductSchema } from "../src/lib/validations/catalog";
import { createMemoryDb } from "./helpers/memory-db";

function fixture() {
  const tables: Record<string, Array<Record<string, unknown>>> = {
    category: [{ id: "catA", companyId: "A", name: "Pains", sortOrder: 0, active: true }],
    product: [
      { id: "baguette", companyId: "A", categoryId: "catA", name: "Baguette", unit: "pièce", basePriceCents: 110, vatRateBasisPoints: 550, active: true, photoUrl: null, allergens: [], allergensDeclared: false },
      { id: "painB", companyId: "B", categoryId: "catB", name: "Pain B", unit: "pièce", basePriceCents: 200, vatRateBasisPoints: 550, active: true, photoUrl: null, allergens: [], allergensDeclared: false },
    ],
  };
  const db = createMemoryDb(tables, {
    decorate: {
      product: (row, all) => ({
        category: { name: (all.category ?? []).find((category) => category.id === row.categoryId)?.name ?? "", active: true },
        _count: { merchantPrices: 0 },
      }),
    },
  }) as unknown as CatalogDb;
  return { db, tables };
}

test("lot 1, demande 3 : les 14 allergènes réglementaires, dans l'ordre de la demande", () => {
  assert.deepEqual(ALLERGENS.map((allergen) => allergen.label), [
    "Céréales contenant du gluten", "Crustacés", "Œufs", "Poissons", "Arachides", "Soja", "Lait", "Fruits à coque",
    "Céleri", "Moutarde", "Graines de sésame", "Anhydride sulfureux et sulfites", "Lupin", "Mollusques",
  ]);
});

test("lot 1, demande 3 : jamais renseigné → « non renseignés » ; bouton → « Aucun allergène » ; gluten et lait visibles", async () => {
  const { db, tables } = fixture();
  // Vérification 2 : un produit jamais renseigné affiche « Allergènes non renseignés », pas « Aucun allergène ».
  assert.equal(allergenSummary(productAllergens({ allergens: [], allergensDeclared: false })), "Allergènes non renseignés");
  // Vérification 1 : l'administrateur coche « gluten » et « lait » sur la baguette.
  const baguette = await updateProduct("A", "baguette", { allergens: ["MILK", "GLUTEN", "MILK"] }, db);
  assert.deepEqual(baguette.allergens, ["GLUTEN", "MILK"], "ordre réglementaire, sans doublon");
  assert.equal(allergenSummary(baguette.allergens), "Céréales contenant du gluten, Lait");
  // Vérification 3 : un produit déclaré sans allergène affiche « Aucun allergène ».
  const created = await createProduct("A", { name: "Pain sans rien", categoryId: "catA", unit: "pièce", basePriceCents: 100, vatRateBasisPoints: 550, active: true, allergens: [] }, db);
  assert.deepEqual(created.allergens, []);
  assert.equal(allergenSummary(created.allergens), "Aucun allergène");
  // Remettre à « non renseignés » ; une modification sans `allergens` ne touche pas la déclaration.
  assert.equal((await updateProduct("A", created.id, { allergens: null }, db)).allergens, null);
  assert.deepEqual((await updateProduct("A", "baguette", { basePriceCents: 120 }, db)).allergens, ["GLUTEN", "MILK"]);
  // Autre entreprise : introuvable.
  await assert.rejects(updateProduct("A", "painB", { allergens: ["MILK"] }, db), { status: 404 });
  assert.deepEqual(tables.product!.find((row) => row.id === "painB")!.allergens, []);
});

test("lot 1, demande 3 : saisie bornée aux codes connus ; colonnes cohérentes", () => {
  assert.equal(updateProductSchema.safeParse({ allergens: ["GLUTEN", "MILK"] }).success, true);
  assert.equal(updateProductSchema.safeParse({ allergens: ["INGREDIENT_LIBRE"] }).success, false);
  assert.equal(createProductSchema.safeParse({ name: "X", categoryId: "c", unit: "pièce", basePriceCents: 1, vatRateBasisPoints: 550, active: true }).success, true, "allergènes facultatifs");
  assert.deepEqual(allergenColumns(null), { allergens: [], allergensDeclared: false });
  assert.deepEqual(allergenColumns([]), { allergens: [], allergensDeclared: true });
});
