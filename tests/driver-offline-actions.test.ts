import assert from "node:assert/strict";
import test from "node:test";
import {
  createQueuedDriverAction,
  enqueueDriverAction,
  actionNeedsAttention,
  processQueuedDriverActions,
  purgeExpiredDriverActions,
  settleSentDriverActions,
  DRIVER_ACTION_MAX_AGE_MS,
  type DriverActionQueueStore,
  type QueuedDriverAction,
} from "../src/features/driver/offline-action-queue";
import { DriverApiError } from "../src/features/driver/driver-api-error";
import { applyPendingActions } from "../src/features/driver/round/effective-rounds";
import type { DriverRoundView } from "../src/domains/round/round.types";

function memoryStore(): DriverActionQueueStore & { rows: Map<string, QueuedDriverAction> } {
  const rows = new Map<string, QueuedDriverAction>();
  return {
    rows,
    async add(action) {
      if ([...rows.values()].some((row) => row.ownerId === action.ownerId && row.actionKey === action.actionKey)) {
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

test("LIV-06 : un problème avec photo reste entier après coupure puis disparaît après reprise", async () => {
  const store = memoryStore();
  const photo = new Blob([new Uint8Array([137, 80, 78, 71])], { type: "image/png" });
  const action = createQueuedDriverAction({
    id: "action-1",
    ownerId: "driver-a",
    actionKey: "stop:stop-a:incident",
    now: 1_000,
    payload: { kind: "INCIDENT", stopId: "stop-a", at: "2026-11-10T05:12:00.000Z", code: "ABSENT", comment: "rideau fermé", photo },
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
  assert.equal(kept.payload.kind, "INCIDENT");
  const keptPhoto = kept.payload.kind === "INCIDENT" ? kept.payload.photo : null;
  assert.equal(keptPhoto, photo);
  assert.deepEqual([...new Uint8Array(await keptPhoto!.arrayBuffer())], [137, 80, 78, 71]);

  let sends = 0;
  const recovered = await processQueuedDriverActions({
    store,
    ownerId: "driver-a",
    force: true,
    now: () => 8_000,
    send: async (queued) => {
      sends++;
      assert.equal(queued.id, "action-1");
      assert.equal(queued.payload.kind === "INCIDENT" ? queued.payload.comment : null, "rideau fermé");
    },
  });
  assert.deepEqual(recovered.sent, ["action-1"]);
  assert.equal(sends, 1);
  // RECETTE-V1 N1 : reçue, l'action reste à l'écran (« sent ») mais la photo ne reste pas sur le téléphone.
  const sent = (await store.list("driver-a"))[0]!;
  assert.equal(sent.state, "sent");
  assert.equal(sent.payload.kind === "INCIDENT" ? sent.payload.photo?.size : null, 0);
  assert.deepEqual(await settleSentDriverActions(store, "driver-a", 8_000), ["action-1"]);
  assert.deepEqual(await store.list("driver-a"), []);
});

test("LIV-06 : une action refusée reste visible et le même geste n'est jamais mis deux fois en file", async () => {
  const store = memoryStore();
  const action = createQueuedDriverAction({
    id: "action-failed",
    ownerId: "driver-a",
    actionKey: "stop:stop-a:delivered",
    now: 10,
    payload: { kind: "DELIVERED", stopId: "stop-a", at: "2026-11-10T05:12:00.000Z" },
  });
  await enqueueDriverAction(store, action);
  await assert.rejects(
    enqueueDriverAction(store, createQueuedDriverAction({
      id: "action-double",
      ownerId: "driver-a",
      actionKey: "stop:stop-a:delivered",
      now: 11,
      payload: { kind: "DELIVERED", stopId: "stop-a", at: "2026-11-10T05:12:30.000Z" },
    })),
    /DRIVER_ACTION_ALREADY_QUEUED/
  );

  const refused = new DriverApiError("arrêt déplacé", { retryable: false });
  const result = await processQueuedDriverActions({
    store,
    ownerId: "driver-a",
    send: async () => { throw refused; },
  });
  assert.deepEqual(result.failed, ["action-failed"]);
  const [kept] = await store.list("driver-a");
  assert.ok(kept);
  assert.equal(kept.state, "failed");
  assert.equal(kept.lastError, "arrêt déplacé");
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
      actionKey: `stop:${id}:incident`,
      now: now - ageMs,
      payload: { kind: "INCIDENT", stopId: id, at: new Date(now - ageMs).toISOString(), code: "DAMAGED", comment: "", photo },
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

function roundWith(stopStatus: "PENDING" | "DELIVERED"): DriverRoundView {
  const stop = (id: string, status: "PENDING" | "DELIVERED") => ({ id, status, deliveredAt: null, incident: null }) as unknown as DriverRoundView["stops"][number];
  return {
    id: "round-1",
    status: "IN_PROGRESS",
    stops: [stop("stop-beta", stopStatus), stop("stop-delta", "PENDING"), stop("stop-alpha", "PENDING")],
  } as unknown as DriverRoundView;
}

test("RECETTE-V1 N1, LIV-06 : « Livré » reçu par le serveur reste livré à l'écran tant qu'aucune lecture fraîche ne l'a remplacé", async () => {
  const store = memoryStore();
  await enqueueDriverAction(store, createQueuedDriverAction({
    id: "beta-livre",
    ownerId: "driver-a",
    actionKey: "stop:stop-beta:delivered",
    now: 1_000,
    payload: { kind: "DELIVERED", stopId: "stop-beta", at: "2026-11-07T06:00:00.000Z" },
  }));

  // En ligne : envoyé, le serveur répond à 2 000. L'action passe à « sent » au lieu d'être effacée.
  const run = await processQueuedDriverActions({ store, ownerId: "driver-a", now: () => 2_000, send: async () => undefined });
  assert.deepEqual(run.sent, ["beta-livre"]);
  const [sent] = await store.list("driver-a");
  assert.equal(sent?.state, "sent");
  assert.equal(sent?.sentAt, 2_000);
  assert.equal(actionNeedsAttention(sent!, false), false, "jamais compté « en attente », même hors réseau");

  // Le réseau tombe : la tournée relue est une copie d'avant l'envoi (Beta « en attente »). Beta reste livré, sans badge.
  const stale = applyPendingActions([roundWith("PENDING")], await store.list("driver-a"), () => true);
  assert.equal(stale[0]!.stops[0]!.status, "DELIVERED");
  assert.equal(stale[0]!.stops[0]!.pendingSync, false);
  assert.equal(stale[0]!.progress.delivered, 1);

  // Pas de second envoi : l'action reçue n'est jamais rejouée par la file (ni par « Réessayer »).
  let sends = 0;
  const again = await processQueuedDriverActions({ store, ownerId: "driver-a", force: true, now: () => 3_000, send: async () => { sends++; } });
  assert.equal(sends, 0);
  assert.deepEqual(again, { sent: [], waiting: [], failed: [] });

  // Une lecture fraîche commencée avant la réponse du serveur ne suffit pas.
  assert.deepEqual(await settleSentDriverActions(store, "driver-a", 1_999), []);
  assert.equal((await store.list("driver-a")).length, 1);
  // Une lecture fraîche commencée après : l'écran suit le serveur, même s'il dit autre chose.
  assert.deepEqual(await settleSentDriverActions(store, "driver-a", 2_000), ["beta-livre"]);
  const fresh = applyPendingActions([roundWith("PENDING")], await store.list("driver-a"));
  assert.equal(fresh[0]!.stops[0]!.status, "PENDING");
});

test("RECETTE-V1 N1 : la lecture fraîche ne retire que les actions reçues, jamais celles en attente ou refusées", async () => {
  const store = memoryStore();
  const make = (id: string, now: number) =>
    createQueuedDriverAction({ id, ownerId: "driver-a", actionKey: `stop:${id}:delivered`, now, payload: { kind: "DELIVERED", stopId: id, at: "2026-11-07T06:00:00.000Z" } });
  await store.put({ ...make("recue", 1), state: "sent", sentAt: 10 });
  await store.put({ ...make("en-attente", 2), attempts: 1 });
  await store.put({ ...make("refusee", 3), state: "failed", lastError: "refus" });
  await store.put({ ...make("autre-compte", 4), ownerId: "driver-b", state: "sent", sentAt: 10 });
  assert.deepEqual(await settleSentDriverActions(store, "driver-a", 50), ["recue"]);
  assert.deepEqual([...store.rows.keys()].sort(), ["autre-compte", "en-attente", "refusee"]);
});
