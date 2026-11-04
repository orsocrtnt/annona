import assert from "node:assert/strict";
import test from "node:test";
import { prisma } from "../src/services/prisma/client";
import { linkPortalDataToClient } from "../src/domains/client-portal/client-data.service";

type Row = Record<string, unknown>;
function matches(row: Row, where: Row): boolean {
  return Object.entries(where).every(([key, value]) => {
    if (value && typeof value === "object") {
      const rule = value as Row;
      if ("equals" in rule) return String(row[key]).toLowerCase() === String(rule.equals).toLowerCase();
      return !!row[key] && matches(row[key] as Row, rule);
    }
    return row[key] === value;
  });
}
function fixtures(role = "CLIENT") {
  const user = { id: "client-a", email: "Client@Example.com", companyId: "a", role: { systemRole: role } };
  const orders = [
    { id: "own", companyId: "a", customerEmail: "CLIENT@example.com", customerId: null },
    { id: "foreign", companyId: "b", customerEmail: "client@example.com", customerId: null },
    { id: "assigned", companyId: "a", customerEmail: "client@example.com", customerId: "other-client" },
    { id: "other-email", companyId: "a", customerEmail: "other@example.com", customerId: null },
    { id: "legacy-cross-company", companyId: "b", customerEmail: "client@example.com", customerId: "client-a" },
  ];
  const children = () => [
    ...orders.map((order) => ({ id: order.id, companyId: order.companyId, customerId: null, order })),
    { id: "child-company-mismatch", companyId: "b", customerId: null, order: orders[0] },
    { id: "parent-company-mismatch", companyId: "a", customerId: null, order: orders[4] },
    { id: "already-assigned", companyId: "a", customerId: "other-client", order: orders[0] },
  ];
  const deliveries = children(); const invoices = children();
  // MAIL-PONT, étape 4 : fiches sans accès du même client, dans A et dans B.
  const cards: Row[] = [
    { id: "card-a", companyId: "a", email: "client@example.com", userId: null },
    { id: "card-b", companyId: "b", email: "client@example.com", userId: null },
  ];
  let writes = 0;
  function delegate(rows: Row[]) {
    return { updateMany: async ({ where, data }: { where: Row; data: Row }) => {
      const selected = rows.filter((row) => matches(row, where));
      for (const row of selected) Object.assign(row, data);
      writes += selected.length;
      return { count: selected.length };
    } };
  }
  const tx = {
    user: { findFirst: async ({ where }: { where: Row }) => matches(user, where) ? user : null },
    order: delegate(orders), delivery: delegate(deliveries), invoice: delegate(invoices),
    companyCustomer: delegate(cards),
  };
  return { orders, deliveries, invoices, cards, tx, writes: () => writes };
}

test("même e-mail dans A/B : seule la chaîne de A est rattachée, sans écraser les propriétaires", async (t) => {
  const f = fixtures();
  t.mock.method(prisma, "$transaction", async (fn: (tx: typeof f.tx) => Promise<void>) => fn(f.tx));
  await linkPortalDataToClient("client-a", " client@example.com ", "a");
  assert.equal(f.orders[0]?.customerId, "client-a");
  assert.equal(f.orders[1]?.customerId, null);
  assert.equal(f.orders[2]?.customerId, "other-client");
  assert.equal(f.orders[3]?.customerId, null);
  for (const rows of [f.deliveries, f.invoices]) {
    assert.equal(rows[0]?.customerId, "client-a");
    assert.ok(rows.slice(1, -1).every((row) => row.customerId === null));
    assert.equal(rows.at(-1)?.customerId, "other-client");
  }
  assert.equal(f.cards[0]?.userId, "client-a", "la fiche sans accès de A est rattachée au compte");
  assert.equal(f.cards[1]?.userId, null, "la fiche de B reste à B");
  assert.equal(f.writes(), 4);
  await linkPortalDataToClient("client-a", "client@example.com", "a");
  assert.equal(f.writes(), 4, "une nouvelle connexion ne change aucun rattachement");
});

for (const role of ["DRIVER", "COMPANY_ADMIN", "MINI_ADMIN", "SUPER_ADMIN"]) {
  test(`aucun rattachement pour le rôle ${role}`, async (t) => {
    const f = fixtures(role);
    t.mock.method(prisma, "$transaction", async (fn: (tx: typeof f.tx) => Promise<void>) => fn(f.tx));
    await linkPortalDataToClient("client-a", "client@example.com", "a");
    assert.equal(f.writes(), 0);
  });
}

test("identité, e-mail et entreprise doivent correspondre au compte en base", async (t) => {
  const f = fixtures();
  const transaction = t.mock.method(prisma, "$transaction", async (fn: (tx: typeof f.tx) => Promise<void>) => fn(f.tx));
  await linkPortalDataToClient("client-a", "client@example.com", null);
  assert.equal(transaction.mock.callCount(), 0);
  for (const args of [["unknown", "client@example.com", "a"], ["client-a", "other@example.com", "a"], ["client-a", "client@example.com", "b"]]) {
    await linkPortalDataToClient(args[0]!, args[1]!, args[2]!);
  }
  assert.equal(f.writes(), 0);
});
