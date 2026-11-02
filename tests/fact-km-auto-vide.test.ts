import assert from "node:assert/strict";
import test from "node:test";
import { announcedCourierLine } from "../src/domains/company/courier-estimate.service";
import { listUnissuedDeliveryInvoices } from "../src/domains/invoice/company-invoices.service";

const course = {
  deliveryCategory: "COURIER",
  pickupAddress: "1 rue du Départ",
  pickupCity: "Paris",
  pickupPostalCode: "75001",
  shippingAddress: "2 rue de l'Arrivée",
  shippingCity: "Paris",
  shippingPostalCode: "75011",
  requestedDeliveryDate: null,
};

test("FACT-KM : la course reprend le prix annoncé au client, avec la distance", async () => {
  const line = await announcedCourierLine("c1", course, (async () => ({ enabled: true, amount: 14.6, distanceKm: 5.5 })) as never);
  assert.deepEqual(line, { label: "Course, environ 5.5 km", amount: 14.6 });
});

test("FACT-KM : rien d'annoncé, rien de prérempli : estimation masquée, distance incalculable ou commande classique", async () => {
  const hidden = (async () => ({ enabled: false, amount: null, distanceKm: null })) as never;
  assert.equal(await announcedCourierLine("c1", course, hidden), null);
  const noGeo = (async () => ({ enabled: true, amount: null, distanceKm: null })) as never;
  assert.equal(await announcedCourierLine("c1", course, noGeo), null);
  const unused = (async () => assert.fail("pas d'estimation pour une commande classique")) as never;
  assert.equal(await announcedCourierLine("c1", { ...course, deliveryCategory: "STANDARD" }, unused), null);
  assert.equal(await announcedCourierLine("c1", { ...course, pickupAddress: null }, unused), null);
});

function db(jobs: unknown[], orders: unknown[]) {
  return {
    operationJob: { findMany: async () => jobs },
    order: { findMany: async () => orders },
  } as never;
}

test("FACT-AUTO-VIDE : l'entreprise voit la commande sans facture et sa raison", async () => {
  const rows = await listUnissuedDeliveryInvoices("c1", db(
    [{ payload: { orderId: "o1" }, lastError: "DELIVERY_INVOICE_EMPTY" }],
    [{ id: "o1", reference: "CRS-1", shippingPostalCode: "13001" }],
  ));
  assert.equal(rows.length, 1);
  assert.equal(rows[0]?.orderReference, "CRS-1");
  assert.match(rows[0]?.reason ?? "", /13001/);
});

test("FACT-AUTO-VIDE : plus rien à signaler quand aucune tâche n'a échoué ou que la facture existe", async () => {
  assert.deepEqual(await listUnissuedDeliveryInvoices("c1", db([], [])), []);
  assert.deepEqual(await listUnissuedDeliveryInvoices("c1", db([{ payload: { orderId: "o1" }, lastError: "DELIVERY_INVOICE_EMPTY" }], [])), []);
});
