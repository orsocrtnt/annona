import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { createOrderFromIntake } from "../src/domains/order-intake/order-intake.service";

type Stored = { companyId: string; idempotencyKey: string; customerId: string; id: string };

/** Base et « service de commande » mémoire : verrou consultatif par clé, tenu jusqu'à la fin de la transaction. */
function world() {
  const orders: Stored[] = [];
  const locks = new Map<string, Promise<void>>();
  const events: string[] = [];
  const tick = () => new Promise((done) => setImmediate(done));
  const clients = [
    { id: "client-a", companyId: "company-a", status: "ACTIVE", email: "a@example.invalid" },
    { id: "client-c", companyId: "company-a", status: "ACTIVE", email: "c@example.invalid" },
  ];
  const db = {
    company: { findUnique: async () => ({ settings: { orderIntake: { enabled: true } } }) },
    user: { findFirst: async ({ where }: { where: { id: string } }) => clients.find((c) => c.id === where.id) ?? null },
    order: {
      findFirst: async ({ where }: { where: { companyId: string; idempotencyKey: string } }) =>
        orders.find((o) => o.companyId === where.companyId && o.idempotencyKey === where.idempotencyKey) ?? null,
    },
  };
  const createOrder = async (
    customerId: string, companyId: string, _email: string, _input: unknown,
    request: { idempotencyKey?: string; beforeCreate?: (tx: unknown) => Promise<void> }
  ) => {
    events.push("geocode"); // fait avant la transaction, comme createClientOrder
    await tick();
    const held: Array<() => void> = [];
    const tx = {
      order: db.order,
      $executeRaw: async (strings: TemplateStringsArray, ...values: unknown[]) => {
        assert.match(strings.join("?"), /pg_advisory_xact_lock\(hashtextextended\(/);
        const key = values.join("|");
        while (locks.has(key)) await locks.get(key);
        let release = () => {};
        locks.set(key, new Promise<void>((done) => { release = () => { locks.delete(key); done(); }; }));
        held.push(release);
        events.push("lock");
        return 0;
      },
    };
    events.push("tx-start");
    try {
      await request.beforeCreate?.(tx);
      const existing = orders.find((o) => o.customerId === customerId && o.idempotencyKey === request.idempotencyKey && o.companyId === companyId);
      if (existing) return { id: existing.id };
      await tick();
      const row = { companyId, idempotencyKey: request.idempotencyKey!, customerId, id: `order-${orders.length + 1}` };
      orders.push(row);
      return { id: row.id };
    } finally {
      held.forEach((release) => release());
    }
  };
  return { orders, events, db, createOrder };
}

const base = { order: { deliveryCategory: "STANDARD" } as never, companyId: "company-a" };
const run = (w: ReturnType<typeof world>, customerId: string, key: string) =>
  createOrderFromIntake({ ...base, customerId, idempotencyKey: key }, {
    db: w.db as never, assertCategory: async () => undefined, createOrder: w.createOrder as never,
  });

test("I1 : deux appels simultanés, deux clients, même clé → une création et un conflit", async () => {
  const w = world();
  const results = await Promise.all([run(w, "client-a", "intake-race-0001"), run(w, "client-c", "intake-race-0001")]);
  assert.equal(w.orders.length, 1, "une seule commande");
  assert.deepEqual(results.map((r) => r.status).sort(), ["conflict", "created"]);
  assert.ok(w.events.includes("lock"), "verrou consultatif pris dans la transaction");
});

test("I1 : rejeu pour le même client → même commande, sans doublon", async () => {
  const w = world();
  const first = await run(w, "client-a", "intake-replay-0001");
  const again = await run(w, "client-a", "intake-replay-0001");
  assert.equal(w.orders.length, 1);
  assert.deepEqual(again, first);
});

test("I1 : autre client avec une clé déjà utilisée (séquentiel) → conflit", async () => {
  const w = world();
  await run(w, "client-a", "intake-seq-0001");
  assert.equal((await run(w, "client-c", "intake-seq-0001")).status, "conflict");
  assert.equal(w.orders.length, 1);
});

test("I1 : le géocodage précède la transaction (contrôle statique de createClientOrder)", () => {
  const source = readFileSync(new URL("../src/domains/order/order.service.ts", import.meta.url), "utf8");
  const body = source.slice(source.indexOf("export async function createClientOrder"));
  const standard = body.slice(body.indexOf("const isCourier"));
  const tx = standard.indexOf("prisma.$transaction");
  assert.ok(tx > 0);
  assert.ok(standard.indexOf("resolveDeliveryCoordinateFields") < tx, "géocodage standard avant la transaction");
  const special = body.slice(0, body.indexOf("const isCourier"));
  assert.ok(special.indexOf("resolveStopCoordinates") < special.indexOf("prisma.$transaction"), "géocodage mission avant la transaction");
  const insideTx = standard.slice(tx);
  assert.equal(/resolve(Delivery|Stop)Coordinate/.test(insideTx.slice(0, insideTx.indexOf("maxWait"))), false, "aucun géocodage dans la transaction");
  assert.equal((body.match(/request\.beforeCreate/g) ?? []).length >= 2, true, "garde appelée dans les deux transactions");
});
