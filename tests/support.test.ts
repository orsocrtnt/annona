import assert from "node:assert/strict";
import test, { type TestContext } from "node:test";
import { prisma } from "../src/services/prisma/client";
import {
  createClientTicket, getClientTickets, getClientTicketById,
  addClientTicketMessage, InvalidSupportReferenceError,
} from "../src/domains/support/support.service";

// En mémoire, sans base : une commande appartient à un commerçant, lui-même représenté par des comptes clients.
const merchantA = { id: "m-a", companyId: "company-a", users: [{ id: "client-a", companyId: "company-a" }] };
const merchantOther = { id: "m-o", companyId: "company-a", users: [{ id: "other", companyId: "company-a" }] };
const merchantB = { id: "m-b", companyId: "company-b", users: [{ id: "client-b", companyId: "company-b" }] };
const own = { id: "order-a", companyId: "company-a", merchant: merchantA };
const otherClient = { id: "order-other", companyId: "company-a", merchant: merchantOther };
const foreign = { id: "order-b", companyId: "company-b", merchant: merchantB };
const orders = [own, otherClient, foreign];

type Row = Record<string, unknown>;
function matches(row: Row, where: Row): boolean {
  return Object.entries(where).every(([key, value]) => {
    if (key === "AND") return (value as Row[]).every((part) => matches(row, part));
    if (key === "OR") return (value as Row[]).some((part) => matches(row, part));
    if (value && typeof value === "object" && "is" in value) {
      return !!row[key] && matches(row[key] as Row, value.is as Row);
    }
    if (value && typeof value === "object" && "some" in value) {
      return Array.isArray(row[key]) && (row[key] as Row[]).some((item) => matches(item, value.some as Row));
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

test("réclamation : commande du commerçant du client ET de son entreprise, vérifiée avant toute insertion", async (t) => {
  const created: Row[] = [];
  const tx = {
    order: { findFirst: async ({ where }: { where: Row }) => orders.find((r) => matches(r, where)) ?? null },
    supportTicket: { create: async ({ data }: { data: Row }) => { created.push(data); return data; } },
  };
  t.mock.method(prisma, "$transaction", async (fn: (client: typeof tx) => Promise<unknown>) => fn(tx));
  for (const refs of [{}, { relatedOrderId: own.id }]) {
    await createClientTicket("client-a", "company-a", { ...payload, ...refs });
  }
  assert.equal(created.length, 2);
  // Le premier message porte aussi l'entreprise (PLA-01).
  assert.equal((created[0]!.messages as { create: Row }).create.companyId, "company-a");
  for (const refs of [{ relatedOrderId: foreign.id }, { relatedOrderId: otherClient.id }, { relatedOrderId: "missing" }, { relatedOrderId: "" }]) {
    await assert.rejects(createClientTicket("client-a", "company-a", { ...payload, ...refs }), InvalidSupportReferenceError);
  }
  await assert.rejects(createClientTicket("client-a", "company-b", { ...payload, relatedOrderId: own.id }), InvalidSupportReferenceError);
  assert.equal(created.length, 2, "aucun ticket/message inséré lors d'un refus");
});

test("anciens tickets étrangers masqués dans liste, détail et réponses", async (t) => {
  const base = { customerId: "client-a", companyId: "company-a", relatedOrderId: null };
  const tickets = [
    { ...base, id: "general" },
    { ...base, id: "valid", relatedOrderId: own.id, relatedOrder: own },
    { ...base, id: "bad-order", relatedOrderId: foreign.id, relatedOrder: foreign },
    { ...base, id: "other-client", relatedOrderId: otherClient.id, relatedOrder: otherClient },
    { ...base, id: "wrong-company", companyId: "company-b" },
    { ...base, id: "wrong-customer", customerId: "client-b" },
  ];
  replaceMethod(t, prisma.supportTicket, "findMany", async ({ where }: { where: Row }) => tickets.filter((r) => matches(r, where)));
  replaceMethod(t, prisma.supportTicket, "findFirst", async ({ where }: { where: Row }) => tickets.find((r) => matches(r, where)) ?? null);
  const messages: Row[] = [];
  replaceMethod(t, prisma.supportTicketMessage, "create", async ({ data }: { data: Row }) => { messages.push(data); return data; });
  replaceMethod(t, prisma.supportTicket, "update", async () => ({}));
  assert.deepEqual((await getClientTickets("client-a", "company-a")).map((r) => r.id), ["general", "valid"]);
  for (const id of ["bad-order", "other-client", "wrong-company", "wrong-customer", "missing"]) {
    assert.equal(await getClientTicketById("client-a", "company-a", id), null);
    assert.equal(await addClientTicketMessage("client-a", "company-a", id, "message"), null);
  }
  assert.equal(messages.length, 0);
  assert.ok(await getClientTicketById("client-a", "company-a", "valid"));
  assert.ok(await addClientTicketMessage("client-a", "company-a", "valid", "message"));
  assert.equal(messages.length, 1);
  assert.equal(messages[0]!.companyId, "company-a");
});
