import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { runInNewContext } from "node:vm";
import { randomUUID } from "node:crypto";
import ts from "typescript";
import { NextResponse } from "next/server";
import * as validation from "../src/lib/validations/delivery";
import * as codes from "../src/lib/pod/codes";
import * as podImage from "../src/lib/storage/pod-image";

function load<T>(file: string, deps: Record<string, unknown>): T {
  const module = { exports: {} };
  const js = ts.transpileModule(readFileSync(resolve(file), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  runInNewContext(js, { Error, Buffer, File, exports: module.exports, module, require: (id: string) => { assert.ok(id in deps, `Unexpected dependency ${id}`); return deps[id]; } });
  return module.exports as T;
}
function storage(publicBucket = false) {
  const signed: string[] = []; const uploads: string[] = []; const removed: string[] = [];
  let lookups = 0;
  const stored = ["delivery-123.jpg", "delivery-124.jpg", "other-125.jpg"];
  const pod = load<typeof import("../src/lib/storage/pod")>("src/lib/storage/pod.ts", {
    "node:crypto": { randomUUID },
    "@/lib/storage/pod-image": podImage,
    "@/services/supabase/admin": { createAdminClient: () => ({ storage: {
      listBuckets: async () => { lookups++; return { data: [{ name: "delivery-pods", public: publicBucket }], error: null }; },
      from: () => ({
        createSignedUrl: async (path: string, seconds: number) => { assert.equal(seconds, 300); signed.push(path); return { data: { signedUrl: "https://storage.invalid/signed" }, error: null }; },
        upload: async (path: string, _bytes: Buffer, options: { upsert: boolean }) => { assert.equal(options.upsert, false); uploads.push(path); return { error: null }; },
        list: async () => ({ data: stored.map(name => ({ name })), error: null }),
        remove: async (paths: string[]) => { removed.push(...paths); return { error: null }; },
      }),
    } }) },
  });
  return { pod, signed, uploads, removed, lookups: () => lookups };
}
test("signature : entreprise ET livraison exactes, aucun accès pour chemins étrangers ou traversée", async () => {
  const f = storage();
  for (const path of ["b/delivery-123.jpg", "a/other-123.jpg", "a/delivery-x-123.jpg", "a/delivery-../other.jpg", "a/delivery-123.jpg/../other", "https://evil/a/delivery-123.jpg", "a/delivery-123.svg", "a/delivery-%2e%2e.jpg"]) {
    assert.equal(await f.pod.getPodPhotoSignedUrl(path, "a", "delivery"), null);
  }
  assert.equal(f.lookups(), 0); assert.deepEqual(f.signed, []);
  assert.equal(await f.pod.getPodPhotoSignedUrl("a/delivery-123.jpg", "a", "delivery"), "https://storage.invalid/signed");
  assert.deepEqual(f.signed, ["a/delivery-123.jpg"]);
});
test("bucket public : lecture et upload refusés ; erreur non conservée indéfiniment en cache", async () => {
  const f = storage(true);
  await assert.rejects(f.pod.getPodPhotoSignedUrl("a/delivery-123.jpg", "a", "delivery"), /POD_STORAGE_PUBLIC/);
  await assert.rejects(f.pod.getPodPhotoSignedUrl("a/delivery-123.jpg", "a", "delivery"), /POD_STORAGE_PUBLIC/);
  assert.equal(f.lookups(), 2); assert.deepEqual(f.signed, []);
});
test("upload : limite 5 Mo, signature JPEG/PNG, MIME cohérent, nom unique et pas d’écrasement", async () => {
  const f = storage();
  for (const [bytes, contentType] of [[Buffer.from('<svg/>'), 'image/svg+xml'], [Buffer.from([255,216,255,0]), 'image/jpeg'], [Buffer.from([137,80,78,71,13,10,26,10]), 'image/png'], [Buffer.alloc(5 * 1024 * 1024 + 1), 'image/png']] as const) {
    await assert.rejects(f.pod.uploadPodPhoto({ companyId: "a", deliveryId: "delivery", bytes, contentType }), /POD_(INVALID_PHOTO|PHOTO_TOO_LARGE)/);
  }
  assert.equal(f.lookups(), 0);
  const bytes = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=", "base64");
  const first = await f.pod.uploadPodPhoto({ companyId: "a", deliveryId: "delivery", bytes, contentType: "image/png" });
  const second = await f.pod.uploadPodPhoto({ companyId: "a", deliveryId: "delivery", bytes, contentType: "image/png" });
  assert.notEqual(first, second); assert.equal(f.pod.isPodPhotoPathForDelivery(first, "a", "delivery"), true);
});

test("orphelins : suppression bornée à la livraison et conservation de la preuve attachée", async () => {
  const f = storage();
  await f.pod.cleanupPodPhotoOrphans({ companyId: "a", deliveryId: "delivery", keepPath: "a/delivery-124.jpg" });
  assert.deepEqual(f.removed, ["a/delivery-123.jpg"]);
  await f.pod.deletePodPhoto("a/delivery-125.jpg", "a", "delivery");
  assert.equal(f.removed.at(-1), "a/delivery-125.jpg");
  await assert.rejects(f.pod.deletePodPhoto("b/delivery-123.jpg", "a", "delivery"), /POD_INVALID_PATH/);
});

test("PATCH livreur réel simulé : un chemin JSON ne peut ni devenir une preuve ni déclencher un upload", async () => {
  let updateCalls = 0; let uploadCalls = 0;
  const route = load<typeof import("../src/app/api/driver/missions/[id]/route")>("src/app/api/driver/missions/[id]/route.ts", {
    "next/server": { NextResponse },
    "@/lib/api/auth-guard": { requireDriverRole: async () => ({ context: { user: { id: "driver-a", companyId: "a" } } }) },
    "@/services/prisma/client": { prisma: { delivery: { findFirst: async ({ where }: { where: Record<string, string> }) => {
      assert.equal(where.companyId, "a"); assert.equal(where.driverId, "driver-a"); return where.id === "own" ? { companyId: "a" } : null;
    } } } },
    "@/domains/delivery/delivery.service": { getDriverMissionById: async () => null, updateDeliveryStatusByDriver: async () => { updateCalls++; return {}; } },
    "@/lib/validations/delivery": validation,
    "@/domains/delivery/driver-proximity.service": { DriverProximityError: class extends Error {} },
    "@/lib/storage/pod": { MAX_POD_BYTES: 5 * 1024 * 1024, MAX_POD_REQUEST_BYTES: 6 * 1024 * 1024, validatePodPhoto: () => {}, uploadPodPhoto: async () => { uploadCalls++; return "path"; }, deletePodPhoto: async () => {}, cleanupPodPhotoOrphans: async () => ({ removed: 0 }), getPodPhotoSignedUrl: async () => null },
    "@/lib/pod/codes": codes,
  });
  const request = () => new Request("http://local", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ status: "DELIVERED", podPhotoPath: "b/victim-123.jpg" }) });
  assert.equal((await route.PATCH(request(), { params: Promise.resolve({ id: "own" }) })).status, 400);
  assert.equal((await route.PATCH(request(), { params: Promise.resolve({ id: "foreign" }) })).status, 404);
  assert.equal(updateCalls, 0); assert.equal(uploadCalls, 0);
});

function podRouteFixture(initialStatus: "PURCHASING" | "IN_DELIVERY" | "DELIVERED" | "FAILED" = "IN_DELIVERY") {
  const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=", "base64");
  const state = {
    existing: {
      companyId: "a", status: initialStatus, podOutcome: initialStatus === "DELIVERED" ? "SUCCESS" : initialStatus === "FAILED" ? "FAILED" : null,
      podPhotoPath: initialStatus === "DELIVERED" ? "a/own-123.jpg" : null,
      podFailureCode: initialStatus === "FAILED" ? "ABSENT" : null, podNote: initialStatus === "IN_DELIVERY" ? null : "note",
    },
    updateError: "" as string,
  };
  const calls = { uploads: 0, updates: 0, deletes: [] as string[], cleanups: 0, signs: 0 };
  const mission = () => ({ id: "own", ...state.existing, order: {} });
  const route = load<typeof import("../src/app/api/driver/missions/[id]/route")>("src/app/api/driver/missions/[id]/route.ts", {
    "next/server": { NextResponse },
    "@/lib/api/auth-guard": { requireDriverRole: async () => ({ context: { user: { id: "driver-a", companyId: "a" } } }) },
    "@/services/prisma/client": { prisma: { delivery: { findFirst: async () => state.existing } } },
    "@/domains/delivery/delivery.service": {
      getDriverMissionById: async () => mission(),
      updateDeliveryStatusByDriver: async (_driver: string, _id: string, status: string, options: Record<string, unknown>) => {
        calls.updates++;
        if (state.updateError) throw new Error(state.updateError);
        state.existing = { ...state.existing, status: status as typeof state.existing.status, podOutcome: options.podOutcome as string, podPhotoPath: options.podPhotoPath as string, podFailureCode: (options.podFailureCode as string) ?? null, podNote: (options.podNote as string) ?? null };
        return mission();
      },
    },
    "@/lib/validations/delivery": validation,
    "@/domains/delivery/driver-proximity.service": { DriverProximityError: class extends Error {} },
    "@/lib/storage/pod": {
      MAX_POD_BYTES: 5 * 1024 * 1024, MAX_POD_REQUEST_BYTES: 5.5 * 1024 * 1024,
      validatePodPhoto: (bytes: Buffer, type: string) => {
        assert.equal(type, "image/png");
        if (!bytes.equals(png)) throw new Error("POD_INVALID_PHOTO");
      },
      uploadPodPhoto: async () => { calls.uploads++; return "a/own-456.jpg"; },
      deletePodPhoto: async (path: string) => { calls.deletes.push(path); },
      cleanupPodPhotoOrphans: async () => { calls.cleanups++; return { removed: 1 }; },
      getPodPhotoSignedUrl: async () => { calls.signs++; return "https://storage.invalid/signed"; },
    },
    "@/lib/pod/codes": codes,
  });
  const request = (status: "DELIVERED" | "FAILED", options?: { note?: string; failureCode?: string; bytes?: Buffer }) => {
    const form = new FormData();
    form.set("status", status); form.set("podOutcome", status === "FAILED" ? "FAILED" : "SUCCESS");
    if (options?.note) form.set("podNote", options.note);
    if (options?.failureCode) form.set("podFailureCode", options.failureCode);
    if (status === "DELIVERED" || options?.bytes) form.set("photo", new Blob([new Uint8Array([...(options?.bytes ?? png)])], { type: "image/png" }), "proof.png");
    return new Request("http://local", { method: "PATCH", body: form });
  };
  return { route, state, calls, request, png };
}

test("PATCH POD : valide avant stockage et supprime l'upload si la transaction échoue", async () => {
  const f = podRouteFixture();
  f.state.updateError = "DELIVERY_STATUS_CONFLICT";
  const response = await f.route.PATCH(f.request("DELIVERED", { note: "remis" }), { params: Promise.resolve({ id: "own" }) });
  assert.equal(response.status, 409); assert.equal(f.calls.uploads, 1); assert.deepEqual(f.calls.deletes, ["a/own-456.jpg"]); assert.equal(f.calls.cleanups, 0);
  const invalid = await f.route.PATCH(f.request("DELIVERED", { bytes: Buffer.from("not an image") }), { params: Promise.resolve({ id: "own" }) });
  assert.equal(invalid.status, 400); assert.equal(f.calls.uploads, 1);
});

test("PATCH POD : réponse perdue rejouée sans second upload, conflit différent refusé", async () => {
  const f = podRouteFixture();
  const first = await f.route.PATCH(f.request("DELIVERED", { note: "note" }), { params: Promise.resolve({ id: "own" }) });
  assert.equal(first.status, 200); assert.equal(f.calls.uploads, 1); assert.equal(f.calls.updates, 1); assert.equal(f.calls.cleanups, 1);
  assert.equal("podPhotoPath" in (await first.clone().json()).data, false);
  const replay = await f.route.PATCH(f.request("DELIVERED", { note: "note" }), { params: Promise.resolve({ id: "own" }) });
  const replayBody = await replay.json();
  assert.equal(replay.status, 200); assert.equal(replayBody.replay, true); assert.equal(f.calls.uploads, 1); assert.equal(f.calls.updates, 1);
  const conflict = await f.route.PATCH(f.request("DELIVERED", { note: "autre" }), { params: Promise.resolve({ id: "own" }) });
  assert.equal(conflict.status, 409); assert.equal(f.calls.uploads, 1);
});

test("PATCH POD : résultat et motif cohérents, limite requête refusée avant lecture", async () => {
  const f = podRouteFixture("FAILED");
  const same = await f.route.PATCH(f.request("FAILED", { failureCode: "ABSENT", note: "note" }), { params: Promise.resolve({ id: "own" }) });
  assert.equal(same.status, 200); assert.equal(f.calls.uploads, 0);
  const missing = podRouteFixture();
  assert.equal((await missing.route.PATCH(missing.request("FAILED"), { params: Promise.resolve({ id: "own" }) })).status, 400);
  const oversized = new Request("http://local", { method: "PATCH", headers: { "content-type": "multipart/form-data; boundary=x", "content-length": String(6 * 1024 * 1024) }, body: "--x--" });
  assert.equal((await missing.route.PATCH(oversized, { params: Promise.resolve({ id: "own" }) })).status, 413);
  assert.equal(missing.calls.uploads, 0);
  const prematureForm = new FormData();
  prematureForm.set("status", "IN_DELIVERY");
  prematureForm.set("photo", new Blob([new Uint8Array([...missing.png])], { type: "image/png" }), "proof.png");
  const premature = new Request("http://local", { method: "PATCH", body: prematureForm });
  assert.equal((await missing.route.PATCH(premature, { params: Promise.resolve({ id: "own" }) })).status, 400);
  assert.equal(missing.calls.uploads, 0);
});

test("MOB-01B : rejeuer un palier déjà validé ne crée aucune seconde mutation", async () => {
  const f = podRouteFixture("PURCHASING");
  const response = await f.route.PATCH(new Request("http://local", {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ status: "PURCHASING" }),
  }), { params: Promise.resolve({ id: "own" }) });
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.equal(body.replay, true);
  assert.equal(f.calls.updates, 0);
  assert.equal(f.calls.uploads, 0);
});
