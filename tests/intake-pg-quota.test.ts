import assert from "node:assert/strict";
import test from "node:test";
import { ORDER_INTAKE_RESERVE_TX, reserveOrderIntakeCall } from "../src/domains/order-intake/order-intake.usage";

test("INTAKE-1 : la réservation de quota attend le verrou au-delà des 2 s par défaut de Prisma", async () => {
  let options: unknown;
  const tx = {
    $queryRaw: async () => [{ locked: 1 }],
    orderIntakeUsage: { count: async () => 0, create: async () => ({ id: "usage-1" }), findFirst: async () => null },
  };
  const db = {
    $transaction: async (fn: (client: typeof tx) => Promise<unknown>, opts?: unknown) => { options = opts; return fn(tx); },
  } as unknown as Parameters<typeof reserveOrderIntakeCall>[3];
  const result = await reserveOrderIntakeCall("company-1", "modele", new Date(), db);
  assert.deepEqual(result, { status: "reserved", id: "usage-1" });
  assert.deepEqual(options, ORDER_INTAKE_RESERVE_TX);
  assert.ok(ORDER_INTAKE_RESERVE_TX.maxWait > 2_000 && ORDER_INTAKE_RESERVE_TX.timeout > ORDER_INTAKE_RESERVE_TX.maxWait);
});
