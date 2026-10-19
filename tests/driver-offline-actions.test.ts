import assert from "node:assert/strict";
import test from "node:test";
import {
  createQueuedDriverAction,
  enqueueDriverAction,
  processQueuedDriverActions,
  type DriverActionQueueStore,
  type QueuedDriverAction,
} from "../src/features/driver/offline-action-queue";
import { driverApi, DriverApiError } from "../src/features/driver/api";

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

test("MOB-01B : une panne fetch est classée rejouable sans perdre le corps", async (t) => {
  let calls = 0;
  t.mock.method(globalThis, "fetch", async () => {
    calls++;
    throw new TypeError("offline");
  });
  await assert.rejects(
    driverApi.updateMissionStatus("mission", "DELIVERED", {
      pod: { outcome: "SUCCESS", photo: new Blob(["photo"], { type: "image/jpeg" }) },
    }),
    (error: unknown) => error instanceof DriverApiError && error.retryable === true && error.status === 0
  );
  assert.equal(calls, 1);
});
