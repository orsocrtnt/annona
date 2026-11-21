/**
 * RETOURS-1 (tour de Théo, 21 novembre 2026) : retouches de `outputs/notes-tour.md`.
 * - ADM-04 : commandes classées par client ou par montant.
 * - Lot 2, demande 8 : stock des boutiques regroupé par boutique, lisible.
 * - Lot 2, demandes 2, 9 et 10 : le pâtissier voit pour qui est chaque gâteau (client, particulier, inscription,
 *   instructions, allergènes).
 * - Lot 2, demande 1 : le rôle « vendeuse » s'appelle « compte vente ».
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { parseAdminOrderSort, sortAdminOrders } from "../src/domains/order/admin-order-sort";
import { buildProductDetails } from "../src/domains/production/production.service";
import type { StockRow } from "../src/domains/shop/shop-stock.service";
import { groupStockByShop } from "../src/domains/shop/stock-groups";
import { ROLE_LABELS } from "../src/lib/permissions/rbac";

const orders = [
  { reference: "C-3", merchant: { name: "Zinc" }, subtotalCents: 1200 },
  { reference: "C-1", merchant: { name: "auberge" }, subtotalCents: 5000 },
  { reference: "C-2", merchant: { name: "Étoile" }, subtotalCents: 300 },
];

test("RETOURS-1 / ADM-04 : commandes classées par client (A à Z, sans tenir compte des majuscules ni des accents)", () => {
  assert.deepEqual(sortAdminOrders(orders, "client").map((row) => row.merchant.name), ["auberge", "Étoile", "Zinc"]);
});

test("RETOURS-1 / ADM-04 : commandes classées par montant croissant ou décroissant ; ordre du serveur par défaut", () => {
  assert.deepEqual(sortAdminOrders(orders, "price-asc").map((row) => row.subtotalCents), [300, 1200, 5000]);
  assert.deepEqual(sortAdminOrders(orders, "price-desc").map((row) => row.subtotalCents), [5000, 1200, 300]);
  assert.deepEqual(sortAdminOrders(orders, "default").map((row) => row.reference), ["C-3", "C-1", "C-2"]);
  assert.equal(parseAdminOrderSort("n'importe quoi"), "default");
  assert.equal(parseAdminOrderSort("price-desc"), "price-desc");
});

const stock = (shopId: string, shopName: string, productName: string, inStock: number, toDiscardTonight = 0): StockRow => ({
  shopId,
  shopName,
  productId: `${shopId}-${productName}`,
  productName,
  unit: "pièce",
  family: "PASTRY",
  inStock,
  toDiscardTonight,
  day: { received: null, damagedOnDelivery: null, sold: null, discarded: null },
});

test("RETOURS-1 / lot 2 demande 8 : stock regroupé par boutique, totaux, produits en stock d'abord puis par nom", () => {
  const groups = groupStockByShop([
    stock("b", "Rivoli", "Tarte", 2),
    stock("a", "Bastille", "Éclair", 0),
    stock("a", "Bastille", "Fraisier", 3, 1),
    stock("a", "Bastille", "Choux", 5),
  ]);
  assert.deepEqual(groups.map((group) => group.shopName), ["Bastille", "Rivoli"]);
  assert.deepEqual(groups[0]!.rows.map((row) => row.productName), ["Choux", "Fraisier", "Éclair"]);
  assert.equal(groups[0]!.inStock, 8);
  assert.equal(groups[0]!.toDiscard, 1);
  assert.deepEqual(groupStockByShop([stock("a", "Bastille", "Éclair", 1)], "eclair").length, 1);
  assert.deepEqual(groupStockByShop([stock("a", "Bastille", "Éclair", 1)], "tarte"), []);
});

test("RETOURS-1 / lot 2 demandes 9 et 10 : pour qui est chaque gâteau, avec inscription, instructions et allergènes", () => {
  const details = buildProductDetails({
    lines: [
      { id: "l1", orderId: "o1", productId: "fraisier", quantityOrdered: 1, sizeId: "s6", inscription: "Joyeux anniversaire", cakeOrderId: "c1" },
      { id: "l2", orderId: "o2", productId: "fraisier", quantityOrdered: 2, sizeId: null, inscription: null, cakeOrderId: null },
    ],
    orders: [
      { id: "o1", merchantId: "shop", notes: null },
      { id: "o2", merchantId: "resto", notes: "Sans fruits secs, client allergique" },
    ],
    merchants: [
      { id: "shop", name: "Boutique Bastille", tradeName: null },
      { id: "resto", name: "SAS Resto", tradeName: "Le Zinc" },
    ],
    products: [{ id: "fraisier", allergens: ["GLUTEN", "EGGS"], allergensDeclared: true }],
    servingsBySize: new Map([["s6", 6]]),
    cakeOrders: [{ id: "c1", customerName: "Mme Martin", customerPhone: "0600000000", pickupAt: new Date("2026-11-23T09:00:00Z"), servings: 6 }],
  });
  const fraisier = details.fraisier!;
  assert.equal(fraisier.allergens?.length, 2);
  assert.equal(fraisier.recipients.length, 2);
  const [boutique, resto] = fraisier.recipients;
  assert.equal(boutique!.merchantName, "Boutique Bastille");
  assert.equal(boutique!.customer?.name, "Mme Martin");
  assert.equal(boutique!.servings, 6);
  assert.equal(boutique!.inscription, "Joyeux anniversaire");
  assert.equal(resto!.merchantName, "Le Zinc");
  assert.equal(resto!.customer, null);
  assert.equal(resto!.quantity, 2);
  assert.equal(resto!.notes, "Sans fruits secs, client allergique");
});

test("RETOURS-1 : allergènes non déclarés → null (jamais « aucun » par défaut)", () => {
  const details = buildProductDetails({
    lines: [],
    orders: [],
    merchants: [],
    products: [{ id: "p", allergens: [], allergensDeclared: false }],
    servingsBySize: new Map(),
    cakeOrders: [],
  });
  assert.equal(details.p!.allergens, null);
});

test("RETOURS-1 / lot 2 demande 1 : le rôle SELLER s'affiche « Compte vente », plus « Vendeuse »", () => {
  assert.equal(ROLE_LABELS.SELLER, "Compte vente");
  const shops = readFileSync("src/features/shops/shops-content.tsx", "utf8");
  assert.match(shops, /Créer un compte vente/);
  // Seuls des commentaires peuvent encore dire « vendeuse » ; aucun texte affiché.
  const visible = shops.split("\n").filter((line) => !/^\s*(\/\*\*|\*|\/\/)/.test(line));
  assert.equal(visible.filter((line) => /[Vv]endeuse/.test(line)).length, 0);
});
