import assert from "node:assert/strict";
import test, { type TestContext } from "node:test";
import { prisma } from "../src/services/prisma/client";
import {
  createClientTicket, getClientTickets, getClientTicketById,
  addClientTicketMessage, InvalidSupportReferenceError,
} from "../src/domains/support/support.service";

// In-memory records; no network or database credentials needed.
const own = { id: "order-a", customerId: "client-a", companyId: "company-a" };
const otherClient = { id: "order-other", customerId: "other", companyId: "company-a" };
const foreign = { id: "order-b", customerId: "client-b", companyId: "company-b" };
const orders = [own, otherClient, foreign];
const deliveries = orders.map((order) => ({
  ...order, id: `delivery-${order.id}`, orderId: order.id, order,
}));

type Row = Record<string, unknown>;
function matches(row: Row, where: Row): boolean {
  return Object.entries(where).every(([key, value]) => {
    if (key === "AND") return (value as Row[]).every((part) => matches(row, part));
    if (key === "OR") return (value as Row[]).some((part) => matches(row, part));
    if (value && typeof value === "object" && "is" in value) {
      return !!row[key] && matches(row[key] as Row, value.is as Row);
    }
    return row[key] === value;
  });
}
function replaceMethod(t: TestContext, target: object, key: string, fn: unknown) {
  const original = Reflect.get(target, key);
  Reflect.set(target, key, fn);
  t.after(() => { Reflect.set(target, key, original); });
}
const payload = { subject: "Test support", message: "Message de test support" };

test("création support : propriété client ET entreprise, avant toute insertion", async (t) => {
  const created: Row[] = [];
  const tx = {
    order: { findFirst: async ({ where }: { where: Row }) => orders.find((r) => matches(r, where)) ?? null },
    delivery: { findFirst: async ({ where }: { where: Row }) => deliveries.find((r) => matches(r, where)) ?? null },
    supportTicket: { create: async ({ data }: { data: Row }) => { created.push(data); return data; } },
  };
  t.mock.method(prisma, "$transaction", async (fn: (client: typeof tx) => Promise<unknown>) => fn(tx));
  for (const refs of [
    {}, { relatedOrderId: own.id }, { relatedDeliveryId: deliveries[0]!.id },
    { relatedOrderId: own.id, relatedDeliveryId: deliveries[0]!.id },
  ]) {
    await createClientTicket("client-a", "company-a", { ...payload, ...refs });
  }
  assert.equal(created.length, 4);
  for (const refs of [
    { relatedOrderId: foreign.id }, { relatedOrderId: otherClient.id },
    { relatedDeliveryId: deliveries[1]!.id }, { relatedDeliveryId: deliveries[2]!.id },
    { relatedOrderId: "missing" }, { relatedDeliveryId: "missing" },
    { relatedOrderId: "" }, { relatedDeliveryId: "" },
    { relatedOrderId: own.id, relatedDeliveryId: deliveries[2]!.id },
  ]) {
    await assert.rejects(createClientTicket("client-a", "company-a", { ...payload, ...refs }), InvalidSupportReferenceError);
  }
  await assert.rejects(createClientTicket("client-a", "company-b", { ...payload, relatedOrderId: own.id }), InvalidSupportReferenceError);
  assert.equal(created.length, 4, "aucun ticket/message inséré lors d'un refus");
});

test("deux ressources personnelles doivent appartenir à la même commande", async (t) => {
  let writes = 0;
  t.mock.method(prisma, "$transaction", async (fn: (tx: unknown) => Promise<unknown>) => fn({
    order: { findFirst: async () => own },
    delivery: { findFirst: async ({ where }: { where: Row }) => {
      const delivery = { ...deliveries[0], orderId: "another-owned-order" };
      return matches(delivery, where) ? delivery : null;
    } },
    supportTicket: { create: async () => { writes++; } },
  }));
  await assert.rejects(createClientTicket("client-a", "company-a", {
    ...payload, relatedOrderId: own.id, relatedDeliveryId: deliveries[0]!.id,
  }), InvalidSupportReferenceError);
  assert.equal(writes, 0);
});

test("anciens tickets étrangers masqués dans liste, détail et réponses", async (t) => {
  const base = { customerId: "client-a", companyId: "company-a", relatedOrderId: null, relatedDeliveryId: null };
  const tickets = [
    { ...base, id: "general" },
    { ...base, id: "valid", relatedOrderId: own.id, relatedOrder: own },
    { ...base, id: "bad-order", relatedOrderId: foreign.id, relatedOrder: foreign },
    { ...base, id: "other-client", relatedOrderId: otherClient.id, relatedOrder: otherClient },
    { ...base, id: "bad-delivery", relatedDeliveryId: deliveries[2]!.id, relatedDelivery: deliveries[2] },
    { ...base, id: "wrong-company", companyId: "company-b" },
    { ...base, id: "wrong-customer", customerId: "client-b" },
  ];
  replaceMethod(t, prisma.supportTicket, "findMany", async ({ where }: { where: Row }) => tickets.filter((r) => matches(r, where)));
  replaceMethod(t, prisma.supportTicket, "findFirst", async ({ where }: { where: Row }) => tickets.find((r) => matches(r, where)) ?? null);
  const messages: Row[] = [];
  replaceMethod(t, prisma.supportTicketMessage, "create", async ({ data }: { data: Row }) => { messages.push(data); return data; });
  replaceMethod(t, prisma.supportTicket, "update", async () => ({}));
  assert.deepEqual((await getClientTickets("client-a", "company-a")).map((r) => r.id), ["general", "valid"]);
  for (const id of ["bad-order", "other-client", "bad-delivery", "wrong-company", "wrong-customer", "missing"]) {
    assert.equal(await getClientTicketById("client-a", "company-a", id), null);
    assert.equal(await addClientTicketMessage("client-a", "company-a", id, "message"), null);
  }
  assert.equal(messages.length, 0);
  assert.ok(await getClientTicketById("client-a", "company-a", "valid"));
  assert.ok(await addClientTicketMessage("client-a", "company-a", "valid", "message"));
  assert.equal(messages.length, 1);
});
