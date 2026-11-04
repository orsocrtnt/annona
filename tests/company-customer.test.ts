import assert from "node:assert/strict";
import test from "node:test";
import { createOrderForCompanyCustomer } from "../src/domains/company-customer/company-customer.service";

type Card = { id: string; companyId: string; name: string; email: string; phone: string | null };
type OrderRow = { id: string; reference: string; companyId: string; idempotencyKey: string; customerId: string | null; companyCustomerId: string | null; customerEmail: string | null };

const USERS = [
  { id: "client-a", companyId: "company-a", email: "compte@client.fr", systemRole: "CLIENT" },
];

const STANDARD = {
  deliveryCategory: "STANDARD",
  items: [{ name: "Colis", quantity: 1 }],
  shippingAddress: "5 place de la Défense",
  shippingCity: "Courbevoie",
  shippingPostalCode: "92400",
  requestedDeliveryDate: "2030-01-15",
} as never;

/**
 * Base mémoire : fiches et commandes filtrées par entreprise comme Prisma. `createOrder` rejoue
 * createClientOrder : relecture idempotente (client vide, clé), puis transaction avec beforeCreate
 * (verrou ignoré), création et afterCreate ; une erreur annule les écritures de la transaction.
 */
function world(options: { cards?: Card[]; orders?: OrderRow[] } = {}) {
  const cards: Card[] = [...(options.cards ?? [])];
  const orders: OrderRow[] = [...(options.orders ?? [])];
  const calls: Array<{ email: string | null; source: unknown; saveAddress: unknown }> = [];
  const findCard = (where: { id?: string; companyId: string; email?: string }) =>
    cards.find((card) => card.companyId === where.companyId && (where.id ? card.id === where.id : card.email === where.email)) ?? null;
  const findOrder = (where: { companyId: string; idempotencyKey: string; customerId?: null }) =>
    orders.find((order) => order.companyId === where.companyId && order.idempotencyKey === where.idempotencyKey && (!("customerId" in where) || order.customerId === null)) ?? null;
  const db = {
    company: { findUnique: async () => ({ settings: {} }) },
    user: {
      findFirst: async ({ where }: { where: { companyId: string; email: { equals: string } } }) =>
        USERS.find((user) => user.companyId === where.companyId && user.email.toLowerCase() === where.email.equals.toLowerCase()) ?? null,
    },
    companyCustomer: { findFirst: async ({ where }: { where: { id?: string; companyId: string; email?: string } }) => findCard(where) },
    order: { findFirst: async ({ where }: { where: { companyId: string; idempotencyKey: string } }) => findOrder(where) },
  };
  const createOrder = async (
    customerId: string | null,
    companyId: string,
    email: string | null,
    input: { source: unknown; saveAddress: unknown },
    request: {
      idempotencyKey: string;
      beforeCreate: (tx: unknown) => Promise<void>;
      afterCreate: (tx: unknown, order: { id: string }) => Promise<void>;
    }
  ) => {
    calls.push({ email, source: input.source, saveAddress: input.saveAddress });
    const existing = findOrder({ companyId, idempotencyKey: request.idempotencyKey, customerId: null });
    if (existing) return existing;
    const cardsBefore = cards.length;
    const ordersBefore = orders.length;
    const tx = {
      $executeRaw: async () => 1,
      companyCustomer: {
        upsert: async ({ where, create }: { where: { companyId_email: { companyId: string; email: string } }; create: Omit<Card, "id"> }) => {
          const found = findCard({ companyId: where.companyId_email.companyId, email: where.companyId_email.email });
          if (found) return { id: found.id };
          const card = { id: `card-${cards.length + 1}`, ...create };
          cards.push(card);
          return { id: card.id };
        },
      },
      order: {
        findFirst: async ({ where }: { where: { companyId: string; idempotencyKey: string } }) => findOrder(where),
        update: async ({ where, data }: { where: { id: string }; data: { companyCustomerId: string } }) => {
          Object.assign(orders.find((order) => order.id === where.id)!, data);
        },
      },
    };
    try {
      await request.beforeCreate(tx);
      const order: OrderRow = { id: `order-${orders.length + 1}`, reference: `CMD-${orders.length + 1}`, companyId, idempotencyKey: request.idempotencyKey, customerId, companyCustomerId: null, customerEmail: email };
      orders.push(order);
      await request.afterCreate(tx, order);
      return order;
    } catch (error) {
      cards.length = cardsBefore;
      orders.length = ordersBefore;
      throw error;
    }
  };
  return { cards, orders, calls, deps: { db: db as never, createOrder: createOrder as never, assertCategory: async () => undefined } };
}

const KEY = "intake-key-card-0001";
const SOPHIE = { kind: "new" as const, customer: { name: "Sophie Leroy", email: "sophie@cabinet.fr", phone: "+33 6 12 34 56 78" } };

test("MAIL-PONT fiche : client inconnu, fiche créée avec la commande, rattachée et sans compte", async () => {
  const w = world();
  const result = await createOrderForCompanyCustomer({ companyId: "company-a", customer: SOPHIE, order: STANDARD, idempotencyKey: KEY }, w.deps);
  assert.deepEqual(result, { status: "created", order: { id: "order-1", reference: "CMD-1" } });
  assert.deepEqual(w.cards, [{ id: "card-1", companyId: "company-a", name: "Sophie Leroy", email: "sophie@cabinet.fr", phone: "0612345678" }]);
  assert.equal(w.orders[0]!.customerId, null, "aucun compte client");
  assert.equal(w.orders[0]!.companyCustomerId, "card-1");
  assert.equal(w.orders[0]!.customerEmail, "sophie@cabinet.fr");
  assert.deepEqual(w.calls[0], { email: "sophie@cabinet.fr", source: "ADMIN", saveAddress: false });
});

test("MAIL-PONT fiche : double clic et reprise après réponse perdue rendent la même commande, une seule fiche", async () => {
  const w = world();
  const first = await createOrderForCompanyCustomer({ companyId: "company-a", customer: SOPHIE, order: STANDARD, idempotencyKey: KEY }, w.deps);
  const second = await createOrderForCompanyCustomer({ companyId: "company-a", customer: SOPHIE, order: STANDARD, idempotencyKey: KEY }, w.deps);
  assert.deepEqual(second, first);
  // La reprise peut aussi désigner la fiche créée au premier essai.
  const byCard = await createOrderForCompanyCustomer({ companyId: "company-a", customer: { kind: "existing", id: "card-1" }, order: STANDARD, idempotencyKey: KEY }, w.deps);
  assert.deepEqual(byCard, first);
  assert.equal(w.orders.length, 1);
  assert.equal(w.cards.length, 1);
});

test("MAIL-PONT fiche : deux clics simultanés, le second voit la commande sous le verrou et la rend", async () => {
  const w = world();
  // Le premier essai a créé la commande entre la relecture du second et sa transaction.
  const original = w.deps.createOrder as unknown as (...args: unknown[]) => Promise<unknown>;
  let raced = false;
  w.deps.createOrder = (async (...args: unknown[]) => {
    if (!raced) {
      raced = true;
      await original(...args);
      const request = args[4] as { beforeCreate: (tx: unknown) => Promise<void> };
      // Rejoue la transaction du second clic sans la relecture préalable.
      const tx = {
        $executeRaw: async () => 1,
        companyCustomer: { upsert: async () => ({ id: "card-1" }) },
        order: { findFirst: async () => w.orders[0], update: async () => undefined },
      };
      await request.beforeCreate(tx);
      assert.fail("le second clic aurait dû être arrêté sous le verrou");
    }
    return original(...args);
  }) as never;
  const result = await createOrderForCompanyCustomer({ companyId: "company-a", customer: SOPHIE, order: STANDARD, idempotencyKey: KEY }, w.deps);
  assert.deepEqual(result, { status: "created", order: { id: "order-1", reference: "CMD-1" } });
  assert.equal(w.orders.length, 1);
});

test("MAIL-PONT fiche : une adresse déjà connue réutilise sa fiche, sans l'écraser", async () => {
  const w = world({ cards: [{ id: "card-x", companyId: "company-a", name: "Cabinet Leroy", email: "sophie@cabinet.fr", phone: null }] });
  const result = await createOrderForCompanyCustomer({ companyId: "company-a", customer: SOPHIE, order: STANDARD, idempotencyKey: KEY }, w.deps);
  assert.equal(result.status, "created");
  assert.equal(w.cards.length, 1);
  assert.equal(w.cards[0]!.name, "Cabinet Leroy");
  assert.equal(w.orders[0]!.companyCustomerId, "card-x");
});

test("MAIL-PONT fiche : isolement entre entreprises, la fiche d'une autre entreprise est introuvable", async () => {
  const w = world({ cards: [{ id: "card-b", companyId: "company-b", name: "Client B", email: "sophie@cabinet.fr", phone: null }] });
  assert.deepEqual(
    await createOrderForCompanyCustomer({ companyId: "company-a", customer: { kind: "existing", id: "card-b" }, order: STANDARD, idempotencyKey: KEY }, w.deps),
    { status: "customer_not_found" }
  );
  assert.equal(w.calls.length, 0);
  // La même adresse a sa propre fiche dans l'entreprise A ; celle de B reste intacte.
  const result = await createOrderForCompanyCustomer({ companyId: "company-a", customer: SOPHIE, order: STANDARD, idempotencyKey: KEY }, w.deps);
  assert.equal(result.status, "created");
  assert.deepEqual(w.cards.map((card) => [card.id, card.companyId]), [["card-b", "company-b"], ["card-2", "company-a"]]);
  assert.equal(w.orders[0]!.companyCustomerId, "card-2");
});

test("MAIL-PONT fiche : une adresse qui a un compte client est refusée (choisir le compte)", async () => {
  const w = world();
  const result = await createOrderForCompanyCustomer(
    { companyId: "company-a", customer: { kind: "new", customer: { name: "Compte", email: "COMPTE@client.fr" } }, order: STANDARD, idempotencyKey: KEY },
    w.deps
  );
  assert.deepEqual(result, { status: "customer_has_account" });
  assert.equal(w.calls.length, 0);
  assert.equal(w.cards.length, 0);
});

test("MAIL-PONT fiche : une clé déjà utilisée pour un autre client est un conflit, rien n'est créé", async () => {
  const taken = (customerId: string | null, companyCustomerId: string | null): OrderRow =>
    ({ id: "order-9", reference: "CMD-9", companyId: "company-a", idempotencyKey: KEY, customerId, companyCustomerId, customerEmail: null });
  for (const previous of [taken("client-a", null), taken(null, "card-autre"), taken(null, null)]) {
    const w = world({ orders: [previous], cards: [{ id: "card-x", companyId: "company-a", name: "X", email: "x@client.fr", phone: null }] });
    assert.deepEqual(
      await createOrderForCompanyCustomer({ companyId: "company-a", customer: { kind: "existing", id: "card-x" }, order: STANDARD, idempotencyKey: KEY }, w.deps),
      { status: "conflict" }
    );
    assert.deepEqual(
      await createOrderForCompanyCustomer({ companyId: "company-a", customer: SOPHIE, order: STANDARD, idempotencyKey: KEY }, w.deps),
      { status: "conflict" }
    );
    assert.equal(w.calls.length, 0);
    assert.equal(w.cards.length, 1, "aucune fiche créée");
  }
});

test("MAIL-PONT fiche : fiche invalide refusée sans écriture", async () => {
  const w = world();
  const result = await createOrderForCompanyCustomer(
    { companyId: "company-a", customer: { kind: "new", customer: { name: "", email: "pas-une-adresse" } }, order: STANDARD, idempotencyKey: KEY },
    w.deps
  );
  assert.deepEqual(result, { status: "customer_not_found" });
  assert.equal(w.calls.length, 0);
});

test("MAIL-PONT fiche : les listes de commandes affichent le nom de la fiche, celle de l'entreprise seulement", async () => {
  const { resolveCustomersByEmail } = await import("../src/domains/order/resolve-customer");
  const seen: unknown[] = [];
  const db = {
    user: { findMany: async () => [{ email: "compte@client.fr", firstName: "Compte", lastName: "Client" }] },
    companyCustomer: {
      findMany: async (args: { where: { companyId: string; email: { in: string[] } } }) => {
        seen.push(args.where);
        return args.where.companyId === "company-a" ? [{ email: "sophie@cabinet.fr", name: "Sophie Leroy" }] : [];
      },
    },
  };
  const rows = [
    { id: "1", customerEmail: "compte@client.fr", customer: null },
    { id: "2", customerEmail: "Sophie@Cabinet.fr", customer: null },
    { id: "3", customerEmail: "inconnu@exemple.fr", customer: null },
    { id: "4", customerEmail: null, customer: null },
  ];
  const resolved = await resolveCustomersByEmail(rows, "company-a", db as never);
  assert.deepEqual(resolved.map((row) => row.customer), [
    { firstName: "Compte", lastName: "Client", email: "compte@client.fr" },
    { firstName: "Sophie Leroy", lastName: "", email: "Sophie@Cabinet.fr" },
    null,
    null,
  ]);
  assert.deepEqual(seen, [{ companyId: "company-a", email: { in: ["sophie@cabinet.fr", "inconnu@exemple.fr"] } }]);
  assert.deepEqual((await resolveCustomersByEmail(rows.slice(1, 2), "company-b", db as never)).map((row) => row.customer), [null]);
});
