import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { applyPrices, computeTotals, loadAppliedPrices, resolveUnitPrice } from "../src/domains/catalog/pricing";
import {
  deleteMerchantPrice,
  reorderCategories,
  updateCategory,
  updateProduct,
  upsertMerchantPrice,
  type CatalogDb,
} from "../src/domains/catalog/catalog.service";
import {
  createProductSchema,
  parseEurosToCents,
  parsePercentToBasisPoints,
  updateCategorySchema,
  upsertMerchantPriceSchema,
} from "../src/lib/validations/catalog";
import { createMemoryDb } from "./helpers/memory-db";

// Deux entreprises, deux clients chez A, un prix spécifique pour le client A1 sur la baguette.
function fixture() {
  return createMemoryDb({
    category: [
      { id: "catA", companyId: "A", name: "Pains", sortOrder: 0, active: true },
      { id: "catA2", companyId: "A", name: "Viennoiseries", sortOrder: 1, active: true },
      { id: "catB", companyId: "B", name: "Pains", sortOrder: 0, active: true },
    ],
    product: [
      { id: "baguette", companyId: "A", categoryId: "catA", name: "Baguette", unit: "pièce", basePriceCents: 110, vatRateBasisPoints: 550, active: true, photoUrl: null },
      { id: "croissant", companyId: "A", categoryId: "catA2", name: "Croissant", unit: "pièce", basePriceCents: 85, vatRateBasisPoints: 550, active: true, photoUrl: null },
      { id: "painB", companyId: "B", categoryId: "catB", name: "Pain B", unit: "pièce", basePriceCents: 200, vatRateBasisPoints: 550, active: true, photoUrl: null },
    ],
    merchant: [
      { id: "A1", companyId: "A", name: "Café A1", active: true },
      { id: "A2", companyId: "A", name: "Épicerie A2", active: true },
      { id: "B1", companyId: "B", name: "Hôtel B1", active: true },
    ],
    merchantPrice: [
      { id: "pA1", companyId: "A", merchantId: "A1", productId: "baguette", priceCents: 95 },
      // Prix d'une autre entreprise pour un identifiant de produit identique : jamais lu pour A.
      { id: "pB1", companyId: "B", merchantId: "A1", productId: "croissant", priceCents: 1 },
    ],
  }, {
    decorate: {
      category: (row, tables) => ({ _count: { products: (tables.product ?? []).filter((product) => product.categoryId === row.id).length } }),
    },
  }) as unknown as CatalogDb;
}

test("CAT-1 RG-05 : prix spécifique s'il existe, sinon prix de base (0 € compris)", () => {
  assert.equal(resolveUnitPrice({ basePriceCents: 110 }, 95), 95);
  assert.equal(resolveUnitPrice({ basePriceCents: 110 }, null), 110);
  assert.equal(resolveUnitPrice({ basePriceCents: 110 }, undefined), 110);
  assert.equal(resolveUnitPrice({ basePriceCents: 110 }, 0), 0, "un prix spécifique à 0 € reste un prix spécifique");
});

test("CAT-1 critère 3 : le client avec prix spécifique le voit, un autre voit le prix de base", async () => {
  const db = fixture();
  const forA1 = await loadAppliedPrices(db, "A", "A1");
  const forA2 = await loadAppliedPrices(db, "A", "A2");
  assert.deepEqual(forA1.get("baguette"), { unitPriceCents: 95, vatRateBasisPoints: 550, isSpecific: true });
  assert.deepEqual(forA2.get("baguette"), { unitPriceCents: 110, vatRateBasisPoints: 550, isSpecific: false });
  // Isolation : le prix de l'entreprise B pour le même identifiant de client n'est pas appliqué chez A.
  assert.equal(forA1.get("croissant")?.unitPriceCents, 85);
  assert.equal(forA1.has("painB"), false, "aucun produit d'une autre entreprise");
});

test("CAT-1 : prix appliqués limités aux produits demandés", async () => {
  const prices = await loadAppliedPrices(fixture(), "A", "A1", ["baguette"]);
  assert.deepEqual([...prices.keys()], ["baguette"]);
  assert.deepEqual(
    applyPrices([{ id: "x", basePriceCents: 300, vatRateBasisPoints: 2000 }], []).get("x"),
    { unitPriceCents: 300, vatRateBasisPoints: 2000, isSpecific: false }
  );
});

test("CAT-1 : totaux HT, TVA arrondie par taux, TTC", () => {
  const totals = computeTotals([
    { quantity: 10, unitPriceCents: 95, vatRateBasisPoints: 550 },
    { quantity: 3, unitPriceCents: 85, vatRateBasisPoints: 550 },
    { quantity: 1, unitPriceCents: 1450, vatRateBasisPoints: 1000 },
  ]);
  // 950 + 255 = 1205 à 5,5 % → 66,275 → 66 ; 1450 à 10 % → 145.
  assert.deepEqual(totals, { subtotalCents: 2655, vatCents: 211, totalCents: 2866, itemCount: 14 });
  assert.deepEqual(computeTotals([]), { subtotalCents: 0, vatCents: 0, totalCents: 0, itemCount: 0 });
});

test("CAT-1 validation : prix, TVA, nom et champs inconnus", () => {
  const valid = { name: "Baguette", categoryId: "catA", unit: "pièce", basePriceCents: 110, vatRateBasisPoints: 550, active: true };
  assert.equal(createProductSchema.safeParse(valid).success, true);
  assert.equal(createProductSchema.safeParse({ ...valid, basePriceCents: -1 }).success, false, "prix négatif");
  assert.equal(createProductSchema.safeParse({ ...valid, basePriceCents: 1.5 }).success, false, "centimes entiers");
  assert.equal(createProductSchema.safeParse({ ...valid, vatRateBasisPoints: 10_001 }).success, false, "TVA > 100 %");
  assert.equal(createProductSchema.safeParse({ ...valid, name: "  " }).success, false, "nom vide");
  assert.equal(createProductSchema.safeParse({ ...valid, unit: "plaque de 12" }).success, true, "unité libre (PLA-04)");
  assert.equal(createProductSchema.safeParse({ ...valid, companyId: "B" }).success, false, "l'entreprise ne vient jamais du corps");
  assert.equal(upsertMerchantPriceSchema.safeParse({ merchantId: "A1", productId: "baguette", priceCents: 95, companyId: "B" }).success, false);
  assert.equal(updateCategorySchema.safeParse({}).success, false, "rien à modifier");
  assert.equal(parseEurosToCents("1,10"), 110);
  assert.equal(parseEurosToCents("0.95"), 95);
  assert.equal(parseEurosToCents("12"), 1200);
  assert.equal(parseEurosToCents("1,105"), null);
  assert.equal(parseEurosToCents("-1"), null);
  assert.equal(parseEurosToCents("abc"), null);
  assert.equal(parsePercentToBasisPoints("5,5"), 550);
  assert.equal(parsePercentToBasisPoints("20"), 2000);
  assert.equal(parsePercentToBasisPoints("101"), null);
});

test("CAT-1 isolation : un identifiant d'une autre entreprise est introuvable (404)", async () => {
  const db = fixture();
  await assert.rejects(updateProduct("A", "painB", { basePriceCents: 1 }, db), { name: "DomainRuleError", status: 404 });
  await assert.rejects(updateProduct("A", "baguette", { categoryId: "catB" }, db), { name: "DomainRuleError", status: 404 });
  await assert.rejects(updateCategory("A", "catB", { active: false }, db), { name: "DomainRuleError", status: 404 });
  await assert.rejects(upsertMerchantPrice("A", { merchantId: "B1", productId: "baguette", priceCents: 1 }, db), { status: 404 });
  await assert.rejects(upsertMerchantPrice("A", { merchantId: "A1", productId: "painB", priceCents: 1 }, db), { status: 404 });
  await assert.rejects(deleteMerchantPrice("A", "pB1", db), { status: 404 });
  await assert.rejects(reorderCategories("A", ["catA", "catB"], db), { status: 409 });
  await assert.rejects(reorderCategories("A", ["catA"], db), { status: 409 }, "liste incomplète");
});

test("CAT-1 ADM-03 : ajout puis remplacement puis suppression d'un prix spécifique", async () => {
  const db = fixture();
  await upsertMerchantPrice("A", { merchantId: "A2", productId: "croissant", priceCents: 70 }, db);
  assert.equal((await loadAppliedPrices(db, "A", "A2")).get("croissant")?.unitPriceCents, 70);
  const replaced = await upsertMerchantPrice("A", { merchantId: "A2", productId: "croissant", priceCents: 75 }, db);
  assert.equal((await loadAppliedPrices(db, "A", "A2")).get("croissant")?.unitPriceCents, 75, "un seul prix par client et produit");
  await deleteMerchantPrice("A", replaced.id, db);
  assert.deepEqual((await loadAppliedPrices(db, "A", "A2")).get("croissant"), { unitPriceCents: 85, vatRateBasisPoints: 550, isSpecific: false });
});

test("CAT-1 ADM-02 : ordre des catégories et désactivation", async () => {
  const db = fixture();
  const rows = await reorderCategories("A", ["catA2", "catA"], db);
  assert.deepEqual(Object.fromEntries(rows.map((row) => [row.id, row.sortOrder])), { catA: 1, catA2: 0 });
  assert.equal(rows.find((row) => row.id === "catA")?.productCount, 1);
  const updated = await updateCategory("A", "catA", { active: false }, db);
  assert.equal(updated.active, false);
});

test("CAT-1 routes : toute écriture du catalogue est réservée à l'administrateur (catalog:manage)", () => {
  const root = "src/app/api/catalog";
  // Lot 1, demandes 2 et 4 : les promotions ont leurs propres permissions (promotions:read / promotions:manage).
  const files = readdirSync(root, { recursive: true }).map(String).filter((file) => file.endsWith("route.ts") && !file.startsWith("promotions"));
  assert.ok(files.length >= 7);
  for (const file of files) {
    const source = readFileSync(join(root, file), "utf8");
    assert.equal(/getCompanyId|companyId\s*:\s*body|searchParams\.get\("companyId"\)/.test(source), false, `${file} : entreprise lue hors session`);
    const methods = source.split(/export async function (GET|POST|PATCH|PUT|DELETE)/);
    for (let index = 1; index < methods.length; index += 2) {
      const method = methods[index]!;
      const body = methods[index + 1]!;
      if (method === "GET") {
        // Lot 1, demande 4 : lecture partagée (correction de commande, promotion, compte client) par plusieurs permissions.
        assert.match(body, /requireCompany(Admin|Member)\("catalog:(read|manage)"\)|requireCompanyAdminAny\(\["catalog:(read|manage)"/, `${file} ${method}`);
      } else {
        assert.match(body, /requireCompanyAdmin\("catalog:manage"\)/, `${file} ${method}`);
      }
    }
  }
});
