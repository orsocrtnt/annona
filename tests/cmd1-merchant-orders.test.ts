import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import {
  firstOpenDeliveryDate,
  isDeliveryDateOrderable,
  isOrderEditable,
  orderCutoffInstant,
} from "../src/domains/order/order-deadline";
import {
  cancelMerchantOrder,
  getMerchantOrder,
  reorderMerchantOrder,
  saveMerchantOrder,
  slotLabel,
  type MerchantRef,
  type OrderDb,
} from "../src/domains/order/merchant-order.service";
import { createRecurringOrder, updateRecurringOrder, type RecurringDb } from "../src/domains/order/recurring-order.service";
import { saveOrderSchema } from "../src/lib/validations/order";
import { createMemoryDb } from "./helpers/memory-db";

const PARIS = "Europe/Paris";
const at = (iso: string) => new Date(iso);

// ---------------------------------------------------------------------------
// isOrderEditable (RG-01, CLI-06, critère de recette 2)
// ---------------------------------------------------------------------------

test("CMD-1 RG-01 : 16:59 modifiable, 17:00:00 verrouillée (heure d'hiver, UTC+1)", () => {
  // Livraison le mardi 10 novembre 2026 : heure limite le lundi 9 à 17:00 Paris = 16:00 UTC.
  assert.equal(orderCutoffInstant("2026-11-10", "17:00", PARIS).toISOString(), "2026-11-09T16:00:00.000Z");
  assert.equal(isOrderEditable("2026-11-10", at("2026-11-09T15:59:00.000Z"), "17:00", PARIS), true, "16:59");
  assert.equal(isOrderEditable("2026-11-10", at("2026-11-09T15:59:59.999Z"), "17:00", PARIS), true, "16:59:59.999");
  assert.equal(isOrderEditable("2026-11-10", at("2026-11-09T16:00:00.000Z"), "17:00", PARIS), false, "17:00:00 pile");
  assert.equal(isOrderEditable("2026-11-10", at("2026-11-09T16:00:01.000Z"), "17:00", PARIS), false, "17:00:01");
  // Une colonne @db.Date (minuit UTC) donne le même résultat qu'une chaîne.
  assert.equal(isOrderEditable(new Date("2026-11-10T00:00:00.000Z"), at("2026-11-09T15:59:00.000Z"), "17:00", PARIS), true);
});

test("CMD-1 RG-01 : J−1 contre J−2 — après 17h, demain est verrouillé mais après-demain reste ouvert", () => {
  const evening = at("2026-11-09T17:30:00.000Z"); // lundi 18:30 Paris
  assert.equal(isOrderEditable("2026-11-10", evening, "17:00", PARIS), false, "J+1 après l'heure limite");
  assert.equal(isOrderEditable("2026-11-11", evening, "17:00", PARIS), true, "J+2 jusqu'au mardi 17:00");
  assert.equal(isOrderEditable("2026-11-11", at("2026-11-10T15:59:00.000Z"), "17:00", PARIS), true, "J−1 à 16:59");
  assert.equal(isOrderEditable("2026-11-11", at("2026-11-10T16:00:00.000Z"), "17:00", PARIS), false, "J−1 à 17:00");
  assert.equal(firstOpenDeliveryDate(at("2026-11-09T15:59:00.000Z"), "17:00", PARIS), "2026-11-10");
  assert.equal(firstOpenDeliveryDate(evening, "17:00", PARIS), "2026-11-11");
});

test("CMD-1 RG-01 : changements d'heure (29 mars et 25 octobre 2026)", () => {
  // Passage à l'heure d'été le dimanche 29 mars 2026 à 2h : 17:00 Paris = 15:00 UTC ce jour-là.
  assert.equal(orderCutoffInstant("2026-03-30", "17:00", PARIS).toISOString(), "2026-03-29T15:00:00.000Z");
  assert.equal(isOrderEditable("2026-03-30", at("2026-03-29T14:59:00.000Z"), "17:00", PARIS), true);
  assert.equal(isOrderEditable("2026-03-30", at("2026-03-29T15:00:00.000Z"), "17:00", PARIS), false);
  // Veille du changement : encore UTC+1.
  assert.equal(orderCutoffInstant("2026-03-29", "17:00", PARIS).toISOString(), "2026-03-28T16:00:00.000Z");
  // Retour à l'heure d'hiver le dimanche 25 octobre 2026 à 3h : 17:00 Paris = 16:00 UTC ce jour-là.
  assert.equal(orderCutoffInstant("2026-10-26", "17:00", PARIS).toISOString(), "2026-10-25T16:00:00.000Z");
  assert.equal(isOrderEditable("2026-10-26", at("2026-10-25T15:59:00.000Z"), "17:00", PARIS), true);
  assert.equal(isOrderEditable("2026-10-26", at("2026-10-25T16:00:00.000Z"), "17:00", PARIS), false);
  // Veille : encore UTC+2.
  assert.equal(orderCutoffInstant("2026-10-25", "17:00", PARIS).toISOString(), "2026-10-24T15:00:00.000Z");
});

test("CMD-1 RG-01 : heure limite et fuseau paramétrables par entreprise", () => {
  assert.equal(orderCutoffInstant("2026-11-10", "15:30", PARIS).toISOString(), "2026-11-09T14:30:00.000Z");
  assert.equal(orderCutoffInstant("2026-11-10", "17:00", "America/New_York").toISOString(), "2026-11-09T22:00:00.000Z");
  assert.throws(() => orderCutoffInstant("2026-11-10", "25:00", PARIS));
  assert.throws(() => orderCutoffInstant("2026-02-30", "17:00", PARIS));
});

test("CMD-1 RG-02 / RG-03 : demain ou plus tard, jamais aujourd'hui ni le passé, 7 jours sur 7", () => {
  const now = at("2026-11-09T08:00:00.000Z"); // lundi 9h Paris
  assert.equal(isDeliveryDateOrderable("2026-11-09", now, PARIS), false, "aujourd'hui");
  assert.equal(isDeliveryDateOrderable("2026-11-01", now, PARIS), false, "passé");
  assert.equal(isDeliveryDateOrderable("2026-11-10", now, PARIS), true, "demain");
  assert.equal(isDeliveryDateOrderable("2026-11-15", now, PARIS), true, "dimanche");
  assert.equal(isDeliveryDateOrderable("2026-13-01", now, PARIS), false, "date invalide");
  // 23h30 UTC le 9 = 0h30 le 10 à Paris : « demain » est le 11.
  assert.equal(isDeliveryDateOrderable("2026-11-10", at("2026-11-09T23:30:00.000Z"), PARIS), false);
});

// ---------------------------------------------------------------------------
// Services (base en mémoire)
// ---------------------------------------------------------------------------

const A1: MerchantRef = { companyId: "A", merchantId: "A1", userId: "uA1" };
const A2: MerchantRef = { companyId: "A", merchantId: "A2", userId: "uA2" };
const BEFORE = at("2026-11-09T15:59:00.000Z"); // lundi 16:59 Paris
const CUTOFF = at("2026-11-09T16:00:00.000Z"); // lundi 17:00 Paris

function fixture() {
  const tables: Record<string, Array<Record<string, unknown>>> = {
    company: [
      { id: "A", cutoffTime: "17:00", timezone: PARIS },
      { id: "B", cutoffTime: "17:00", timezone: PARIS },
    ],
    merchant: [
      { id: "A1", companyId: "A", name: "Café A1", active: true },
      { id: "A2", companyId: "A", name: "Épicerie A2", active: true },
      { id: "A3", companyId: "A", name: "Ancien client", active: false },
      { id: "B1", companyId: "B", name: "Hôtel B1", active: true },
    ],
    slot: [
      { id: "s6", companyId: "A", label: null, startTime: "06:00", endTime: "07:00", active: true },
      { id: "sOff", companyId: "A", label: null, startTime: "09:00", endTime: "10:00", active: false },
      { id: "sB", companyId: "B", label: null, startTime: "06:00", endTime: "07:00", active: true },
    ],
    category: [
      { id: "catA", companyId: "A", active: true },
      { id: "catOff", companyId: "A", active: false },
      { id: "catB", companyId: "B", active: true },
    ],
    product: [
      { id: "baguette", companyId: "A", categoryId: "catA", name: "Baguette", unit: "pièce", basePriceCents: 110, vatRateBasisPoints: 550, active: true, photoUrl: null },
      { id: "croissant", companyId: "A", categoryId: "catA", name: "Croissant", unit: "pièce", basePriceCents: 85, vatRateBasisPoints: 550, active: true, photoUrl: null },
      { id: "retired", companyId: "A", categoryId: "catA", name: "Ancien pain", unit: "pièce", basePriceCents: 300, vatRateBasisPoints: 550, active: false, photoUrl: null },
      { id: "hidden", companyId: "A", categoryId: "catOff", name: "Bûche", unit: "pièce", basePriceCents: 2000, vatRateBasisPoints: 550, active: true, photoUrl: null },
      { id: "painB", companyId: "B", categoryId: "catB", name: "Pain B", unit: "pièce", basePriceCents: 200, vatRateBasisPoints: 550, active: true, photoUrl: null },
    ],
    merchantPrice: [{ id: "pA1", companyId: "A", merchantId: "A1", productId: "baguette", priceCents: 95 }],
    order: [
      // Commande livrée la semaine précédente (source de « Recommander »), prix figés à l'époque.
      { id: "past", companyId: "A", merchantId: "A1", reference: "C261102-OLD", deliveryDate: new Date("2026-11-02T00:00:00.000Z"), slotId: "s6", status: "DELIVERED", origin: "MANUAL", notes: null, createdById: "uA1" },
      { id: "locked", companyId: "A", merchantId: "A1", reference: "C261112-LCK", deliveryDate: new Date("2026-11-12T00:00:00.000Z"), slotId: "s6", status: "LOCKED", origin: "MANUAL", notes: null, createdById: "uA1" },
    ],
    orderLine: [
      { id: "l1", companyId: "A", orderId: "past", productId: "baguette", quantityOrdered: 40, quantityDelivered: 40, unitPriceFrozenCents: 90, createdAt: new Date(1) },
      { id: "l2", companyId: "A", orderId: "past", productId: "croissant", quantityOrdered: 25, quantityDelivered: 25, unitPriceFrozenCents: 80, createdAt: new Date(2) },
      { id: "l3", companyId: "A", orderId: "past", productId: "retired", quantityOrdered: 3, quantityDelivered: 3, unitPriceFrozenCents: 300, createdAt: new Date(3) },
      { id: "l4", companyId: "A", orderId: "locked", productId: "baguette", quantityOrdered: 10, quantityDelivered: null, unitPriceFrozenCents: 95, createdAt: new Date(4) },
    ],
    recurringOrder: [],
    recurringOrderLine: [],
  };
  const db = createMemoryDb(tables, {
    decorate: {
      product: (row, all) => ({ category: { active: Boolean((all.category ?? []).find((category) => category.id === row.categoryId)?.active) } }),
    },
  });
  return { db: db as unknown as OrderDb, tables };
}

const orderFor = (tables: Record<string, Array<Record<string, unknown>>>, merchantId: string, date: string) =>
  (tables.order ?? []).filter((row) => row.merchantId === merchantId && (row.deliveryDate as Date).toISOString().startsWith(date));

test("CMD-1 CLI-04/05 : création validée puis même date et créneau → la même commande est modifiée (unicité)", async () => {
  const { db, tables } = fixture();
  const first = await saveMerchantOrder(A1, { deliveryDate: "2026-11-10", slotId: "s6", lines: [{ productId: "baguette", quantity: 30 }] }, BEFORE, db);
  assert.equal(first.created, true);
  assert.equal(first.order.status, "VALIDATED");
  assert.equal(first.order.editable, true);
  assert.equal(first.order.lines[0]?.unitPriceCents, 95, "prix spécifique du client (RG-05)");
  assert.equal(first.order.subtotalCents, 30 * 95);

  const second = await saveMerchantOrder(
    A1,
    { deliveryDate: "2026-11-10", slotId: "s6", lines: [{ productId: "baguette", quantity: 12 }, { productId: "croissant", quantity: 8 }] },
    BEFORE,
    db
  );
  assert.equal(second.created, false);
  assert.equal(second.order.id, first.order.id, "une seule commande par client, date et créneau");
  assert.equal(orderFor(tables, "A1", "2026-11-10").length, 1);
  assert.deepEqual(second.order.lines.map((line) => [line.productId, line.quantity]), [["baguette", 12], ["croissant", 8]]);
  assert.equal((tables.orderLine ?? []).filter((line) => line.orderId === first.order.id).length, 2, "anciennes lignes remplacées");

  // Un autre client, même date et créneau : sa propre commande.
  const other = await saveMerchantOrder(A2, { deliveryDate: "2026-11-10", slotId: "s6", lines: [{ productId: "baguette", quantity: 5 }] }, BEFORE, db);
  assert.notEqual(other.order.id, first.order.id);
  assert.equal(other.order.lines[0]?.unitPriceCents, 110, "prix de base pour le client sans prix spécifique (critère 3)");
});

test("CMD-1 refus serveur : heure limite, jour même, passé, créneau, produits, client désactivé", async () => {
  const { db, tables } = fixture();
  const base = { deliveryDate: "2026-11-10", slotId: "s6", lines: [{ productId: "baguette", quantity: 1 }] };
  await assert.rejects(saveMerchantOrder(A1, base, CUTOFF, db), { name: "DomainRuleError", status: 409, code: "DEADLINE_PASSED" });
  await assert.rejects(saveMerchantOrder(A1, { ...base, deliveryDate: "2026-11-09" }, BEFORE, db), { status: 400, code: "DATE_TOO_SOON" });
  await assert.rejects(saveMerchantOrder(A1, { ...base, deliveryDate: "2026-10-01" }, BEFORE, db), { status: 400, code: "DATE_TOO_SOON" });
  await assert.rejects(saveMerchantOrder(A1, { ...base, slotId: "sOff" }, BEFORE, db), { status: 400, code: "SLOT_UNAVAILABLE" });
  await assert.rejects(saveMerchantOrder(A1, { ...base, slotId: "sB" }, BEFORE, db), { status: 400, code: "SLOT_UNAVAILABLE" });
  for (const productId of ["retired", "hidden", "painB", "inconnu"]) {
    await assert.rejects(saveMerchantOrder(A1, { ...base, lines: [{ productId, quantity: 1 }] }, BEFORE, db), { status: 400, code: "PRODUCT_UNAVAILABLE" }, productId);
  }
  await assert.rejects(
    saveMerchantOrder(A1, { ...base, lines: [{ productId: "baguette", quantity: 1 }, { productId: "baguette", quantity: 2 }] }, BEFORE, db),
    { status: 400, code: "DUPLICATE_PRODUCT" }
  );
  await assert.rejects(saveMerchantOrder(A1, { ...base, lines: [] }, BEFORE, db), { status: 400, code: "EMPTY_ORDER" });
  await assert.rejects(saveMerchantOrder({ ...A1, merchantId: "A3" }, base, BEFORE, db), { status: 403, code: "MERCHANT_INACTIVE" });
  // Commande verrouillée (LOCK-1) : jamais modifiée par le client, même avant l'heure limite.
  await assert.rejects(saveMerchantOrder(A1, { ...base, deliveryDate: "2026-11-12" }, BEFORE, db), { status: 409, code: "ORDER_LOCKED" });
  await assert.rejects(cancelMerchantOrder(A1, "locked", BEFORE, db), { status: 409, code: "ORDER_LOCKED" });
  assert.equal(orderFor(tables, "A1", "2026-11-10").length, 0, "aucune écriture après un refus");
  // Le schéma refuse une heure libre à la place d'un créneau et une quantité nulle.
  assert.equal(saveOrderSchema.safeParse({ ...base, slotId: undefined, time: "06:30" }).success, false);
  assert.equal(saveOrderSchema.safeParse({ ...base, lines: [{ productId: "baguette", quantity: 0 }] }).success, false);
  assert.equal(saveOrderSchema.safeParse({ ...base, lines: [{ productId: "baguette", quantity: 10_000 }] }).success, false);
});

test("CMD-1 CLI-06 : modification et annulation jusqu'à 16:59, refusées à 17:00 ; réouverture après annulation", async () => {
  const { db, tables } = fixture();
  const { order } = await saveMerchantOrder(A1, { deliveryDate: "2026-11-10", slotId: "s6", lines: [{ productId: "croissant", quantity: 10 }] }, at("2026-11-08T10:00:00.000Z"), db);
  await assert.rejects(
    saveMerchantOrder(A1, { deliveryDate: "2026-11-10", slotId: "s6", lines: [{ productId: "croissant", quantity: 11 }] }, CUTOFF, db),
    { status: 409, code: "DEADLINE_PASSED" }
  );
  await assert.rejects(cancelMerchantOrder(A1, order.id, CUTOFF, db), { status: 409, code: "DEADLINE_PASSED" });
  const cancelled = await cancelMerchantOrder(A1, order.id, BEFORE, db);
  assert.equal(cancelled.status, "CANCELLED");
  assert.equal(cancelled.editable, false);
  await assert.rejects(cancelMerchantOrder(A1, order.id, BEFORE, db), { status: 409, code: "ALREADY_CANCELLED" });
  const reopened = await saveMerchantOrder(A1, { deliveryDate: "2026-11-10", slotId: "s6", lines: [{ productId: "croissant", quantity: 4 }] }, BEFORE, db);
  assert.equal(reopened.order.id, order.id, "la ligne annulée est rouverte, l'unicité tient");
  assert.equal(reopened.order.status, "VALIDATED");
  assert.equal(orderFor(tables, "A1", "2026-11-10").length, 1);
});

test("CMD-1 CLI-08 : « Recommander » recopie la commande passée au prix actuel, sans les produits retirés", async () => {
  const { db, tables } = fixture();
  const { order, droppedCount } = await reorderMerchantOrder(A1, "past", { deliveryDate: "2026-11-10", slotId: "s6" }, BEFORE, db);
  assert.equal(droppedCount, 1, "le produit désactivé est écarté");
  assert.deepEqual(order.lines.map((line) => [line.productId, line.quantity]), [["baguette", 40], ["croissant", 25]]);
  assert.equal(order.lines.find((line) => line.productId === "baguette")?.unitPriceCents, 95, "prix actuel, pas le prix figé de la commande source");
  assert.equal(order.lines.find((line) => line.productId === "croissant")?.unitPriceCents, 85);
  assert.equal(order.status, "VALIDATED");
  assert.equal(order.origin, "MANUAL");
  // Cible déjà commandée : refus 409 avec l'identifiant pour l'ouvrir.
  await assert.rejects(
    reorderMerchantOrder(A1, "past", { deliveryDate: "2026-11-10", slotId: "s6" }, BEFORE, db),
    (error: { status: number; code: string; details: { orderId: string } }) => error.status === 409 && error.code === "ORDER_EXISTS" && error.details.orderId === order.id
  );
  await assert.rejects(reorderMerchantOrder(A1, "past", { deliveryDate: "2026-11-10", slotId: "s6" }, CUTOFF, db), { status: 409, code: "DEADLINE_PASSED" });
  // Une commande annulée sur la cible est rouverte par la recopie.
  await cancelMerchantOrder(A1, order.id, BEFORE, db);
  const again = await reorderMerchantOrder(A1, "past", { deliveryDate: "2026-11-10", slotId: "s6" }, BEFORE, db);
  assert.equal(again.order.id, order.id);
  assert.equal(orderFor(tables, "A1", "2026-11-10").length, 1);
});

test("CMD-1 droits : un client ne lit, n'annule ni ne recopie la commande d'un autre (404)", async () => {
  const { db } = fixture();
  await assert.rejects(getMerchantOrder(A2, "past", BEFORE, db), { status: 404, code: "ORDER_NOT_FOUND" });
  await assert.rejects(cancelMerchantOrder(A2, "locked", BEFORE, db), { status: 404 });
  await assert.rejects(reorderMerchantOrder(A2, "past", { deliveryDate: "2026-11-10", slotId: "s6" }, BEFORE, db), { status: 404 });
  // Autre entreprise avec un identifiant de commerce forgé : rien n'est visible.
  await assert.rejects(getMerchantOrder({ companyId: "B", merchantId: "A1", userId: "x" }, "past", BEFORE, db), { status: 404 });
  const own = await getMerchantOrder(A1, "past", BEFORE, db);
  assert.equal(own.lines.find((line) => line.productId === "baguette")?.unitPriceCents, 90, "historique : prix figé affiché");
  assert.equal(own.lines.find((line) => line.productId === "baguette")?.currentUnitPriceCents, 95);
  assert.equal(own.editable, false);
});

test("CMD-1 CLI-09 : commande récurrente (jours, créneau, suspension) bornée au client", async () => {
  const { db, tables } = fixture();
  const recurringDb = db as unknown as RecurringDb;
  const created = await createRecurringOrder(A1, { slotId: "s6", weekdays: [5, 1, 1, 3], lines: [{ productId: "baguette", quantity: 20 }] }, recurringDb);
  const row = (tables.recurringOrder ?? []).find((candidate) => candidate.id === created.id)!;
  assert.deepEqual(row.weekdays, [1, 3, 5]);
  assert.equal(row.active, true);
  await updateRecurringOrder(A1, created.id, { active: false, lines: [{ productId: "croissant", quantity: 6 }] }, recurringDb);
  assert.equal(row.active, false, "suspendue");
  assert.deepEqual((tables.recurringOrderLine ?? []).filter((line) => line.recurringOrderId === created.id).map((line) => [line.productId, line.quantity]), [["croissant", 6]]);
  await assert.rejects(updateRecurringOrder(A2, created.id, { active: true }, recurringDb), { status: 404 });
  await assert.rejects(createRecurringOrder(A1, { slotId: "sB", weekdays: [1], lines: [{ productId: "baguette", quantity: 1 }] }, recurringDb), { status: 400 });
  await assert.rejects(createRecurringOrder(A1, { slotId: "s6", weekdays: [1], lines: [{ productId: "painB", quantity: 1 }] }, recurringDb), { status: 400 });
});

test("CMD-1 : libellé de créneau sans heure libre", () => {
  assert.equal(slotLabel({ label: null, startTime: "06:00", endTime: "07:00" }), "6h – 7h");
  assert.equal(slotLabel({ label: null, startTime: "06:30", endTime: "07:15" }), "6h30 – 7h15");
  assert.equal(slotLabel({ label: "Matin", startTime: "06:00", endTime: "07:00" }), "Matin");
});

test("CMD-1 routes : toutes les API du portail commande passent par requireMerchantActor", () => {
  const roots = ["src/app/api/portal/orders", "src/app/api/portal/recurring", "src/app/api/portal/catalog", "src/app/api/portal/merchant"];
  for (const root of roots) {
    for (const file of readdirSync(root, { recursive: true }).map(String).filter((entry) => entry.endsWith("route.ts"))) {
      const source = readFileSync(join(root, file), "utf8");
      const methods = source.split(/export async function (GET|POST|PATCH|PUT|DELETE)/);
      assert.ok(methods.length > 1, `${root}/${file}`);
      for (let index = 2; index < methods.length; index += 2) {
        assert.match(methods[index]!, /requireMerchantActor\(\)/, `${root}/${file}`);
      }
      assert.equal(/merchantId\s*:\s*(body|input|params)|searchParams\.get\("(merchantId|companyId)"\)/.test(source), false, `${root}/${file} : commerce lu hors session`);
    }
  }
});

test("CLI-09 : sans créneau ouvert, la fenêtre récurrente le dit au lieu de garder « Enregistrer » grisé sans explication", () => {
  const source = readFileSync("src/features/ordering/recurring-content.tsx", "utf8");
  assert.match(source, /catalog\.slots\.length === 0 \? <p[^>]*>\{fr\.order\.noSlot\}/);
  assert.match(source, /!valid && catalog\.slots\.length > 0 \? <p[^>]*>\{t\.incomplete\}/);
});
