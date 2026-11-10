/**
 * Défauts trouvés par la recette navigateur du lot 1 (10 novembre 2026).
 * D1 : la commande du soir ne reprend pas les articles de la commande du matin (CLI-05).
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { cartSyncAction } from "../src/features/ordering/cart-sync";

const morning = { id: "order_morning", editable: true };

test("LOT1-D1 : passer du matin (commande enregistrée) au soir sans commande vide le panier", () => {
  assert.equal(cartSyncAction({ existing: null, loadedOrderId: morning.id, hasQuantities: true }), "clear");
});

test("LOT1-D1 : un panier jamais enregistré est gardé quand on change de créneau", () => {
  assert.equal(cartSyncAction({ existing: null, loadedOrderId: null, hasQuantities: true }), "keep");
});

test("CLI-05 : commande existante chargée dans un panier vide, conflit si le panier contient autre chose", () => {
  assert.equal(cartSyncAction({ existing: morning, loadedOrderId: null, hasQuantities: false }), "load");
  assert.equal(cartSyncAction({ existing: morning, loadedOrderId: null, hasQuantities: true }), "conflict");
  assert.equal(cartSyncAction({ existing: { ...morning, editable: false }, loadedOrderId: null, hasQuantities: true }), "load");
  assert.equal(cartSyncAction({ existing: morning, loadedOrderId: morning.id, hasQuantities: true }), "keep");
});

test("LOT1-D1 : retour au matin après le soir → la commande du matin est rechargée", () => {
  assert.equal(cartSyncAction({ existing: morning, loadedOrderId: "order_evening", hasQuantities: true }), "load");
  assert.equal(cartSyncAction({ existing: morning, loadedOrderId: "order_evening", hasQuantities: false }), "load");
});
