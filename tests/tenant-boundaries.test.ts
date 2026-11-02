import assert from "node:assert/strict";
import test, { type TestContext } from "node:test";
import { prisma } from "../src/services/prisma/client";
import {
  getClientOrderById,
  getClientOrders,
  getDeliveryReorderTemplate,
} from "../src/domains/order/order.service";
import {
  getClientDeliveries,
  getClientDeliveryById,
  getCompanyDeliveries,
  getDriverMissionById,
} from "../src/domains/delivery/delivery.service";
import {
  getClientInvoiceById,
  getClientInvoices,
} from "../src/domains/invoice/invoice.service";
import { getClientDeliveriesMap } from "../src/domains/delivery/dispatch-map.service";

type Where = Record<string, unknown>;

function replaceMethod(
  t: TestContext,
  target: object,
  key: string,
  value: CallableFunction
) {
  const hadOwn = Object.prototype.hasOwnProperty.call(target, key);
  const previous = Reflect.get(target, key);
  Reflect.set(target, key, value);
  t.after(() => {
    if (hadOwn) Reflect.set(target, key, previous);
    else Reflect.deleteProperty(target, key);
  });
}

test("toutes les lectures client sensibles exigent propriétaire ET entreprise", async (t) => {
  const orderDetails: Where[] = [];
  const orderLists: Where[] = [];
  const deliveryDetails: Where[] = [];
  const deliveryLists: Where[] = [];
  const invoiceDetails: Where[] = [];
  const invoiceLists: Where[] = [];

  // Réglage du portail (téléphone du livreur) lu par la fiche livraison : défaut, sans base.
  replaceMethod(t, prisma.company, "findUnique", async () => ({ settings: {} }) as never);
  // Noms des livreurs de l'entreprise (masquage C3), sans base.
  replaceMethod(t, prisma.user, "findMany", async () => [] as never);
  replaceMethod(t, prisma.order, "findFirst", async (args: { where: Where }) => {
    orderDetails.push(args.where);
    return null as never;
  });
  replaceMethod(t, prisma.order, "findMany", async (args: { where: Where }) => {
    orderLists.push(args.where);
    return [] as never;
  });
  replaceMethod(t, prisma.delivery, "findFirst", async (args: { where: Where }) => {
    deliveryDetails.push(args.where);
    return null as never;
  });
  replaceMethod(t, prisma.delivery, "findMany", async (args: { where: Where }) => {
    deliveryLists.push(args.where);
    return [] as never;
  });
  replaceMethod(t, prisma.invoice, "findFirst", async (args: { where: Where }) => {
    invoiceDetails.push(args.where);
    return null as never;
  });
  replaceMethod(t, prisma.invoice, "findMany", async (args: { where: Where }) => {
    invoiceLists.push(args.where);
    return [] as never;
  });

  await getClientOrderById("client-a", "company-a", "order-a");
  await getClientOrders("client-a", "company-a");
  await getDeliveryReorderTemplate("client-a", "company-a", "delivery-a");
  await getClientDeliveryById("client-a", "company-a", "delivery-a");
  await getClientDeliveries("client-a", "company-a");
  await getClientInvoiceById("client-a", "company-a", "invoice-a");
  await getClientInvoices("client-a", "company-a");

  assert.deepEqual(orderDetails[0], {
    id: "order-a",
    customerId: "client-a",
    companyId: "company-a",
  });
  assert.equal(orderLists[0]?.customerId, "client-a");
  assert.equal(orderLists[0]?.companyId, "company-a");
  assert.deepEqual(deliveryDetails, [
    { id: "delivery-a", customerId: "client-a", companyId: "company-a" },
    { id: "delivery-a", customerId: "client-a", companyId: "company-a" },
    { id: "delivery-a", customerId: "client-a", companyId: "company-a" },
  ]);
  assert.equal(deliveryLists[0]?.customerId, "client-a");
  assert.equal(deliveryLists[0]?.companyId, "company-a");
  assert.deepEqual(invoiceDetails[0], {
    id: "invoice-a",
    customerId: "client-a",
    companyId: "company-a",
  });
  assert.equal(invoiceLists[0]?.customerId, "client-a");
  assert.equal(invoiceLists[0]?.companyId, "company-a");
});

test("carte client et mission livreur conservent la frontière d’entreprise", async (t) => {
  const deliveryQueries: Where[] = [];
  // Noms des livreurs de l'entreprise (masquage C3), sans base.
  replaceMethod(t, prisma.user, "findMany", async () => [] as never);
  replaceMethod(t, prisma.delivery, "findMany", async (args: { where: Where }) => {
    deliveryQueries.push(args.where);
    return [] as never;
  });
  replaceMethod(t, prisma.delivery, "findFirst", async (args: { where: Where }) => {
    deliveryQueries.push(args.where);
    return null as never;
  });

  await getClientDeliveriesMap("client-a", "company-a");
  await getDriverMissionById("driver-a", "company-a", "delivery-a");

  assert.equal(deliveryQueries.length, 3);
  for (const where of deliveryQueries.slice(0, 2)) {
    assert.equal(where.customerId, "client-a");
    assert.equal(where.companyId, "company-a");
  }
  assert.deepEqual(deliveryQueries[2], {
    id: "delivery-a",
    driverId: "driver-a",
    companyId: "company-a",
  });
});

test("dispatch ciblé recherche la livraison seulement dans l’entreprise connectée", async (t) => {
  const deliveryQueries: Where[] = [];
  replaceMethod(t, prisma.delivery, "findMany", async (args: { where: Where }) => {
    deliveryQueries.push(args.where);
    return [] as never;
  });
  replaceMethod(t, prisma.delivery, "findFirst", async (args: { where: Where }) => {
    deliveryQueries.push(args.where);
    return null as never;
  });

  const rows = await getCompanyDeliveries("company-a", {
    includeDeliveryId: "delivery-from-link",
  });

  assert.deepEqual(rows, []);
  assert.equal(deliveryQueries.length, 2);
  assert.equal(deliveryQueries[0]?.companyId, "company-a");
  assert.equal(deliveryQueries[1]?.companyId, "company-a");
  assert.equal(deliveryQueries[1]?.id, "delivery-from-link");
  assert.deepEqual(deliveryQueries[0]?.status, deliveryQueries[1]?.status);
});
