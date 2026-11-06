import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";
import { createOrderForCustomer } from "../src/domains/order/staff-order.service";
import { createOrderFromIntake } from "../src/domains/order-intake/order-intake.service";

type UserRow = { id: string; companyId: string; email: string; status: string; systemRole: string };

const USERS: UserRow[] = [
  { id: "client-a", companyId: "company-a", email: "a@client.fr", status: "ACTIVE", systemRole: "CLIENT" },
  { id: "client-a2", companyId: "company-a", email: "a2@client.fr", status: "ACTIVE", systemRole: "CLIENT" },
  { id: "suspended-a", companyId: "company-a", email: "s@client.fr", status: "SUSPENDED", systemRole: "CLIENT" },
  { id: "staff-a", companyId: "company-a", email: "d@annona.fr", status: "ACTIVE", systemRole: "DISPATCHER" },
  { id: "client-b", companyId: "company-b", email: "b@client.fr", status: "ACTIVE", systemRole: "CLIENT" },
];

/** Base mémoire : filtre comme Prisma sur l'entreprise, l'id et le rôle. Commande par message désactivée. */
function memoryDb(options: { settings?: unknown; orders?: Array<{ companyId: string; idempotencyKey: string; customerId: string }> } = {}) {
  return {
    company: { findUnique: async () => ({ settings: options.settings ?? {} }) },
    user: {
      findFirst: async ({ where }: { where: { id: string; companyId: string; role: { systemRole: string } } }) =>
        USERS.find((user) => user.id === where.id && user.companyId === where.companyId && user.systemRole === where.role.systemRole) ?? null,
    },
    order: {
      findFirst: async ({ where }: { where: { companyId: string; idempotencyKey: string } }) =>
        (options.orders ?? []).find((order) => order.companyId === where.companyId && order.idempotencyKey === where.idempotencyKey) ?? null,
    },
  };
}

const STANDARD = {
  deliveryCategory: "STANDARD",
  items: [{ name: "Colis", quantity: 1 }],
  shippingAddress: "5 place de la Défense",
  shippingCity: "Courbevoie",
  shippingPostalCode: "92400",
  requestedDeliveryDate: "2030-01-15",
  saveAddress: true,
  addressLabel: "Bureau",
  source: "CLIENT",
} as never;

function deps(db: unknown = memoryDb(), overrides: Record<string, unknown> = {}) {
  const calls: unknown[][] = [];
  return {
    calls,
    deps: {
      db: db as never,
      assertCategory: async () => undefined,
      createOrder: (async (...args: unknown[]) => {
        calls.push(args);
        return { id: "order-1", reference: "CMD-1" };
      }) as never,
      ...overrides,
    },
  };
}

const input = (customerId: string, order: unknown = STANDARD) => ({
  companyId: "company-a",
  customerId,
  order: order as never,
  idempotencyKey: "admin-key-0001",
});

test("ADMIN-COMMANDE : créée pour le client choisi, source ADMIN, même si la commande par message est désactivée", async () => {
  const { calls, deps: d } = deps();
  const result = await createOrderForCustomer(input("client-a"), d);
  assert.deepEqual(result, { status: "created", order: { id: "order-1", reference: "CMD-1" } });
  assert.equal(calls.length, 1);
  const [customerId, companyId, email, order, request] = calls[0] as [string, string, string, Record<string, unknown>, { idempotencyKey: string }];
  assert.deepEqual([customerId, companyId, email], ["client-a", "company-a", "a@client.fr"]);
  assert.equal(order.source, "ADMIN", "la source ne vient jamais du corps");
  assert.equal(request.idempotencyKey, "admin-key-0001");
});

test("ADMIN-COMMANDE : le carnet d'adresses du client n'est jamais modifié depuis le back-office", async () => {
  const { calls, deps: d } = deps();
  await createOrderForCustomer(input("client-a"), d);
  const order = (calls[0] as unknown[])[3] as Record<string, unknown>;
  assert.equal(order.saveAddress, false);
});

test("ADMIN-COMMANDE : seul un client actif de l'entreprise est accepté", async () => {
  const { calls, deps: d } = deps();
  assert.deepEqual(await createOrderForCustomer(input("client-b"), d), { status: "customer_not_found" });
  assert.deepEqual(await createOrderForCustomer(input("staff-a"), d), { status: "customer_not_found" });
  assert.deepEqual(await createOrderForCustomer(input("inconnu"), d), { status: "customer_not_found" });
  assert.deepEqual(await createOrderForCustomer(input("suspended-a"), d), { status: "customer_inactive" });
  assert.equal(calls.length, 0);
});

test("ADMIN-COMMANDE : la mission spéciale passe, contrairement à la commande par message", async () => {
  const mission = { deliveryCategory: "SPECIAL_MISSION", missionDescription: "Déménagement", stops: [] };
  const { calls, deps: d } = deps();
  const result = await createOrderForCustomer(input("client-a", mission), d);
  assert.equal(result.status, "created");
  assert.equal(calls.length, 1);

  const intake = deps(memoryDb({ settings: { orderIntake: { enabled: true } } }));
  const refused = await createOrderFromIntake(input("client-a", mission), intake.deps);
  assert.deepEqual(refused, { status: "invalid" });
  assert.equal(intake.calls.length, 0);
});

test("ADMIN-COMMANDE : la commande par message reste soumise à son activation", async () => {
  const { calls, deps: d } = deps();
  assert.deepEqual(await createOrderFromIntake(input("client-a"), d), { status: "disabled" });
  assert.equal(calls.length, 0);
});

test("ADMIN-COMMANDE : type de livraison désactivé et créneau invalide refusés sans création", async () => {
  const off = deps(memoryDb(), {
    assertCategory: async () => {
      throw new Error("DELIVERY_CATEGORY_DISABLED");
    },
  });
  assert.deepEqual(await createOrderForCustomer(input("client-a"), off.deps), { status: "category_disabled" });
  assert.equal(off.calls.length, 0);

  const slots = deps(memoryDb({ settings: { deliverySlots: { mode: "SLOTS", slots: [{ start: "09:00", end: "12:00" }] } } }));
  const result = await createOrderForCustomer(input("client-a"), slots.deps);
  assert.equal(result.status, "slot_invalid");
  assert.equal(slots.calls.length, 0);
});

test("ADMIN-COMMANDE : quota, lecture seule et clé réutilisée deviennent des refus explicites", async () => {
  const cases: Array<[string, string]> = [
    ["SAAS_ORDER_CREATION_BLOCKED", "saas_blocked"],
    ["SAAS_ACCOUNT_READ_ONLY", "saas_read_only"],
    ["IDEMPOTENCY_KEY_REUSED", "conflict"],
  ];
  for (const [message, status] of cases) {
    const { deps: d } = deps(memoryDb(), {
      createOrder: async () => {
        throw new Error(message);
      },
    });
    assert.deepEqual(await createOrderForCustomer(input("client-a"), d), { status }, message);
  }
  const { deps: broken } = deps(memoryDb(), {
    createOrder: async () => {
      throw new Error("panne base");
    },
  });
  await assert.rejects(createOrderForCustomer(input("client-a"), broken), /panne base/);
});

test("ADMIN-COMMANDE : une clé déjà utilisée pour un autre client ne crée pas de seconde commande", async () => {
  const db = memoryDb({ orders: [{ companyId: "company-a", idempotencyKey: "admin-key-0001", customerId: "client-a2" }] });
  const { calls, deps: d } = deps(db);
  assert.deepEqual(await createOrderForCustomer(input("client-a"), d), { status: "conflict" });
  assert.equal(calls.length, 0);
});

test("ADMIN-COMMANDE : double clic, la même clé part pour les deux envois et le verrou est posé", async () => {
  const { calls, deps: d } = deps();
  await Promise.all([createOrderForCustomer(input("client-a"), d), createOrderForCustomer(input("client-a"), d)]);
  assert.equal(calls.length, 2);
  for (const call of calls) {
    const request = call[4] as { idempotencyKey: string; beforeCreate?: unknown };
    assert.equal(request.idempotencyKey, "admin-key-0001");
    assert.equal(typeof request.beforeCreate, "function");
  }
});

test("ADMIN-COMMANDE interface : points d'entrée, formulaire partagé et cibles de 44 px", () => {
  for (const page of ["src/app/(back-office)/dashboard/orders/new/page.tsx", "src/app/(back-office)/dispatch/new-order/page.tsx"]) {
    assert.ok(existsSync(page), page);
    assert.match(readFileSync(page, "utf8"), /NewOrderContent/);
  }
  const content = readFileSync("src/features/back-office/new-order-content.tsx", "utf8");
  assert.match(content, /OrderFormFields/, "même formulaire que le portail");
  assert.match(content, /audience="staff"/);
  assert.match(content, /crypto\.randomUUID\(\)/, "une clé par formulaire");
  assert.doesNotMatch(content, /usePortal/, "aucune route réservée au client");

  const list = readFileSync("src/features/back-office/company-orders-content.tsx", "utf8");
  assert.match(list, /href="\/dashboard\/orders\/new"[^>]*min-h-11/);
  const dispatch = readFileSync("src/app/(back-office)/dispatch/page.tsx", "utf8");
  assert.match(dispatch, /href="\/dispatch\/new-order"[^>]*min-h-11/);

  const form = readFileSync("src/features/client-portal/create-order-form.tsx", "utf8");
  assert.match(form, /audience !== "staff"|audience === "staff"/);
});
