import assert from "node:assert/strict";
import test from "node:test";
import {
  createQueuedDriverAction,
  enqueueDriverAction,
  processQueuedDriverActions,
  purgeExpiredDriverActions,
  DRIVER_ACTION_MAX_AGE_MS,
  type DriverActionQueueStore,
  type QueuedDriverAction,
} from "../src/features/driver/offline-action-queue";
import { DriverApiError } from "../src/features/driver/driver-api-error";

function memoryStore(): DriverActionQueueStore & { rows: Map<string, QueuedDriverAction> } {
  const rows = new Map<string, QueuedDriverAction>();
  return {
    rows,
    async add(action) {
      if ([...rows.values()].some((row) => row.ownerId === action.ownerId && row.missionId === action.missionId)) {
        throw new Error("duplicate");
      }
      rows.set(action.id, action);
    },
    async put(action) { rows.set(action.id, action); },
    async delete(id) { rows.delete(id); },
    async list(ownerId) {
      return [...rows.values()]
        .filter((row) => row.ownerId === ownerId)
        .sort((left, right) => left.createdAt - right.createdAt);
    },
    async listAll() { return [...rows.values()]; },
  };
}

test("MOB-01B : une preuve reste entière après coupure puis disparaît après reprise", async () => {
  const store = memoryStore();
  const photo = new Blob([new Uint8Array([137, 80, 78, 71])], { type: "image/png" });
  const action = createQueuedDriverAction({
    id: "action-1",
    ownerId: "driver-a",
    missionId: "mission-a",
    now: 1_000,
    payload: { status: "DELIVERED", pod: { outcome: "SUCCESS", photo, note: "remis" } },
  });
  await enqueueDriverAction(store, action);

  const offline = new DriverApiError("réseau coupé", { retryable: true });
  const first = await processQueuedDriverActions({
    store,
    ownerId: "driver-a",
    now: () => 1_000,
    send: async () => { throw offline; },
  });
  assert.deepEqual(first.waiting, ["action-1"]);
  const kept = (await store.list("driver-a"))[0];
  assert.ok(kept);
  assert.equal(kept.state, "pending");
  assert.equal(kept.attempts, 1);
  assert.equal(kept.payload.pod?.photo, photo);
  assert.deepEqual([...new Uint8Array(await kept.payload.pod!.photo!.arrayBuffer())], [137, 80, 78, 71]);

  let sends = 0;
  const recovered = await processQueuedDriverActions({
    store,
    ownerId: "driver-a",
    force: true,
    now: () => 8_000,
    send: async (queued) => {
      sends++;
      assert.equal(queued.id, "action-1");
      assert.equal(queued.payload.pod?.note, "remis");
    },
  });
  assert.deepEqual(recovered.sent, ["action-1"]);
  assert.equal(sends, 1);
  assert.deepEqual(await store.list("driver-a"), []);
});

test("MOB-01B : une action refusée reste visible et aucun double envoi par mission n'est admis", async () => {
  const store = memoryStore();
  const action = createQueuedDriverAction({
    id: "action-failed",
    ownerId: "driver-a",
    missionId: "mission-a",
    now: 10,
    payload: { status: "IN_DELIVERY" },
  });
  await enqueueDriverAction(store, action);
  await assert.rejects(
    enqueueDriverAction(store, createQueuedDriverAction({
      id: "action-double",
      ownerId: "driver-a",
      missionId: "mission-a",
      now: 11,
      payload: { status: "IN_DELIVERY" },
    })),
    /MISSION_ACTION_ALREADY_QUEUED/
  );

  const refused = new DriverApiError("mission modifiée", { retryable: false });
  const result = await processQueuedDriverActions({
    store,
    ownerId: "driver-a",
    send: async () => { throw refused; },
  });
  assert.deepEqual(result.failed, ["action-failed"]);
  const [kept] = await store.list("driver-a");
  assert.ok(kept);
  assert.equal(kept.state, "failed");
  assert.equal(kept.lastError, "mission modifiée");
});

test("LEGAL-1 : la file hors ligne efface les actions de plus de sept jours, tous comptes confondus", async () => {
  const store = memoryStore();
  const day = 24 * 60 * 60 * 1_000;
  const now = 100 * day;
  const photo = new Blob([new Uint8Array([1, 2, 3])], { type: "image/png" });
  const make = (id: string, ownerId: string, ageMs: number) =>
    createQueuedDriverAction({
      id,
      ownerId,
      missionId: `mission-${id}`,
      now: now - ageMs,
      payload: { status: "DELIVERED", pod: { outcome: "SUCCESS", photo, recipientName: "Mme Martin" } },
    });
  await enqueueDriverAction(store, make("recent", "driver-a", 6 * day));
  await enqueueDriverAction(store, make("limite", "driver-a", DRIVER_ACTION_MAX_AGE_MS));
  await enqueueDriverAction(store, make("ancienne", "driver-a", 8 * day));
  await enqueueDriverAction(store, make("autre-compte", "driver-b", 30 * day));
  const failed = { ...make("refusee", "driver-a", 9 * day), state: "failed" as const, lastError: "refus" };
  await store.put(failed);
  const sending = { ...make("en-envoi", "driver-a", 9 * day), state: "sending" as const };
  await store.put(sending);

  const purged = await purgeExpiredDriverActions(store, { now });

  assert.deepEqual(purged.sort(), ["ancienne", "autre-compte", "refusee"]);
  assert.deepEqual([...store.rows.keys()].sort(), ["en-envoi", "limite", "recent"]);
  assert.deepEqual(await purgeExpiredDriverActions(store, { now }), []);
});
