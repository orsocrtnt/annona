import assert from "node:assert/strict";
import test from "node:test";
import sharp from "sharp";
import { deflateSync } from "node:zlib";
import {
  isPodSignaturePathForDelivery,
  MAX_SIGNATURE_BYTES,
  normalizePodSignature,
  validatePodSignature,
} from "../src/lib/storage/pod-signature";
import { isPodPhotoPathForDelivery } from "../src/lib/storage/pod";
import { assertPodEvidence, DEFAULT_PROOF_RULES, parseProofRules } from "../src/domains/delivery/pod-evidence";
import {
  createQueuedDriverAction,
  enqueueDriverAction,
  processQueuedDriverActions,
  type DriverActionQueueStore,
  type QueuedDriverAction,
} from "../src/features/driver/offline-action-queue";
import { driverApi, DriverApiError } from "../src/features/driver/api";

async function png(width: number, height: number, alpha = false) {
  return sharp({ create: { width, height, channels: alpha ? 4 : 3, background: alpha ? { r: 0, g: 0, b: 0, alpha: 0 } : "#ffffff" } })
    .png().toBuffer();
}

test("signature : PNG valide, dimensions et taille bornées", async () => {
  assert.deepEqual(validatePodSignature(await png(400, 150), "image/png"), { width: 400, height: 150 });
  assert.throws(() => validatePodSignature(await0(), "image/png"), /POD_SIGNATURE_INVALID/);
  assert.throws(() => validatePodSignature(Buffer.alloc(MAX_SIGNATURE_BYTES + 1), "image/png"), /POD_SIGNATURE_TOO_LARGE/);
  assert.throws(() => validatePodSignature(Buffer.from("<svg/>"), "image/svg+xml"), /POD_SIGNATURE_INVALID/);
  assert.throws(() => validatePodSignature(Buffer.from([255, 216, 255, 224, 0, 16]), "image/png"), /POD_SIGNATURE_INVALID/);
});

function await0() { return Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]); }

test("signature : trop petite ou trop grande refusée", async () => {
  assert.throws(() => validatePodSignature(awaitSync(10, 10), "image/png"), /POD_SIGNATURE_INVALID/);
  assert.throws(() => validatePodSignature(awaitSync(2000, 100), "image/png"), /POD_SIGNATURE_INVALID/);
  assert.throws(() => validatePodSignature(awaitSync(400, 900), "image/png"), /POD_SIGNATURE_INVALID/);
});

// Fixtures PNG minimales mais structurellement valides, sans passer par sharp (taille variable).
function awaitSync(width: number, height: number) {
  const crcTable = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
  const crc = (buf: Buffer) => { let c = 0xffffffff; for (const b of buf) c = crcTable[(c ^ b) & 0xff]! ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
  const chunk = (type: string, data: Buffer) => {
    const head = Buffer.alloc(4); head.writeUInt32BE(data.length);
    const body = Buffer.concat([Buffer.from(type), data]);
    const tail = Buffer.alloc(4); tail.writeUInt32BE(crc(body));
    return Buffer.concat([head, body, tail]);
  };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(width, 0); ihdr.writeUInt32BE(height, 4); ihdr[8] = 8; ihdr[9] = 0;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", ihdr), chunk("IDAT", deflateSync(Buffer.alloc(8))), chunk("IEND", Buffer.alloc(0))]);
}

test("signature : le canevas transparent est aplati sur fond blanc", async () => {
  const output = await normalizePodSignature(await png(200, 80, true));
  const meta = await sharp(output).metadata();
  assert.equal(meta.format, "png");
  assert.equal(meta.hasAlpha, false);
  const { data } = await sharp(output).raw().toBuffer({ resolveWithObject: true });
  assert.deepEqual([...data.subarray(0, 3)], [255, 255, 255]);
});

test("chemins : la signature est liée à son entreprise et à sa livraison, et distincte de la photo", () => {
  const sig = "a/d1-sig-1730000000000-123e4567-e89b-12d3-a456-426614174000.png";
  assert.equal(isPodSignaturePathForDelivery(sig, "a", "d1"), true);
  assert.equal(isPodSignaturePathForDelivery(sig, "b", "d1"), false);
  assert.equal(isPodSignaturePathForDelivery(sig, "a", "d2"), false);
  assert.equal(isPodSignaturePathForDelivery("a/d1-sig-../x.png", "a", "d1"), false);
  assert.equal(isPodSignaturePathForDelivery("a/d1-sig-1.jpg", "a", "d1"), false);
  // Le nettoyage des photos orphelines ne doit jamais supprimer la signature.
  assert.equal(isPodPhotoPathForDelivery(sig, "a", "d1"), false);
});

test("règles de preuve : signature facultative par défaut, requise si l'entreprise le décide", () => {
  assert.deepEqual(DEFAULT_PROOF_RULES, { signatureRequired: false, emailToClient: true });
  assert.deepEqual(parseProofRules(undefined), DEFAULT_PROOF_RULES);
  assert.deepEqual(parseProofRules({ signatureRequired: "oui" }), DEFAULT_PROOF_RULES);
  const required = parseProofRules({ signatureRequired: true });
  assert.throws(() => assertPodEvidence({ status: "DELIVERED", rules: required, hasSignature: false }), /POD_SIGNATURE_REQUIRED/);
  assert.deepEqual(
    assertPodEvidence({ status: "DELIVERED", rules: required, hasSignature: false, signatureRefusedReason: " Refus catégorique " }),
    { recipientName: null, signatureRefusedReason: "Refus catégorique" }
  );
  assert.throws(() => assertPodEvidence({ status: "DELIVERED", rules: required, hasSignature: true }), /POD_RECIPIENT_REQUIRED/);
  assert.doesNotThrow(() => assertPodEvidence({ status: "DELIVERED", rules: DEFAULT_PROOF_RULES, hasSignature: false }));
  assert.throws(() => assertPodEvidence({ status: "FAILED", rules: DEFAULT_PROOF_RULES, hasSignature: false, recipientName: "Paul" }), /POD_SIGNATURE_NOT_ALLOWED/);
});

test("RECETTE-2810 point 7 : nom obligatoire (2 caractères) avec signature, facultatif avec photo seule", () => {
  const base = { status: "DELIVERED" as const, rules: DEFAULT_PROOF_RULES };
  assert.throws(() => assertPodEvidence({ ...base, hasSignature: true, recipientName: "  " }), /POD_RECIPIENT_REQUIRED/);
  assert.throws(() => assertPodEvidence({ ...base, hasSignature: true, recipientName: "M" }), /POD_RECIPIENT_REQUIRED/);
  assert.throws(() => assertPodEvidence({ ...base, hasSignature: false, recipientName: "M" }), /POD_RECIPIENT_REQUIRED/);
  assert.equal(assertPodEvidence({ ...base, hasSignature: true, recipientName: " Mme Martin " }).recipientName, "Mme Martin");
  assert.equal(assertPodEvidence({ ...base, hasSignature: false }).recipientName, null);
});

function memoryStore(): DriverActionQueueStore & { rows: Map<string, QueuedDriverAction> } {
  const rows = new Map<string, QueuedDriverAction>();
  return {
    rows,
    async add(action) { rows.set(action.id, action); },
    async put(action) { rows.set(action.id, action); },
    async delete(id) { rows.delete(id); },
    async list(ownerId) { return [...rows.values()].filter((row) => row.ownerId === ownerId); },
  };
}

test("hors ligne : photo, signature et réceptionnaire restent dans la file puis partent en un seul envoi", async (t) => {
  const store = memoryStore();
  const photo = new Blob([new Uint8Array([1, 2])], { type: "image/jpeg" });
  const signature = new Blob([new Uint8Array([137, 80, 78, 71])], { type: "image/png" });
  await enqueueDriverAction(store, createQueuedDriverAction({
    id: "a1", ownerId: "driver", missionId: "m1", now: 1,
    payload: { status: "DELIVERED", pod: { outcome: "SUCCESS", photo, signature, recipientName: "Mme Martin" } },
  }));
  await processQueuedDriverActions({ store, ownerId: "driver", now: () => 1, send: async () => { throw new DriverApiError("réseau", { retryable: true }); } });
  const kept = (await store.list("driver"))[0]!;
  assert.equal(kept.payload.pod?.signature, signature);
  assert.equal(kept.payload.pod?.recipientName, "Mme Martin");

  const bodies: FormData[] = [];
  t.mock.method(globalThis, "fetch", async (_url: string, init: RequestInit) => {
    bodies.push(init.body as FormData);
    return new Response(JSON.stringify({ data: {}, success: true }), { status: 200 });
  });
  const run = await processQueuedDriverActions({
    store, ownerId: "driver", force: true, now: () => 2,
    send: (action) => driverApi.updateMissionStatus(action.missionId, action.payload.status, { pod: action.payload.pod }),
  });
  assert.deepEqual(run.sent, ["a1"]);
  assert.equal(bodies.length, 1);
  assert.equal(bodies[0]!.get("podRecipientName"), "Mme Martin");
  assert.ok(bodies[0]!.get("signature") instanceof Blob);
  assert.ok(bodies[0]!.get("photo") instanceof Blob);
  assert.equal(store.rows.size, 0);
});

test("hors ligne : refus de signer envoyé avec son motif, sans fichier de signature", async (t) => {
  const bodies: FormData[] = [];
  t.mock.method(globalThis, "fetch", async (_url: string, init: RequestInit) => {
    bodies.push(init.body as FormData);
    return new Response(JSON.stringify({ data: {}, success: true }), { status: 200 });
  });
  await driverApi.updateMissionStatus("m", "DELIVERED", {
    pod: { outcome: "SUCCESS", photo: new Blob([new Uint8Array([1])]), signature: null, signatureRefusedReason: "Refus du client" },
  });
  assert.equal(bodies[0]!.get("signature"), null);
  assert.equal(bodies[0]!.get("podSignatureRefusedReason"), "Refus du client");
});

test("RECETTE-2810 point 8 : une action en premier envoi n'affiche pas « Réessayer maintenant »", async () => {
  const { actionNeedsAttention } = await import("../src/features/driver/offline-action-queue");
  const base = createQueuedDriverAction({ ownerId: "u", missionId: "m", payload: { status: "IN_DELIVERY" } as never });
  assert.equal(actionNeedsAttention(base, true), false);
  assert.equal(actionNeedsAttention({ ...base, state: "sending" }, true), false);
  assert.equal(actionNeedsAttention(base, false), true);
  assert.equal(actionNeedsAttention({ ...base, attempts: 1, lastError: "réseau" }, true), true);
  assert.equal(actionNeedsAttention({ ...base, state: "failed" }, true), true);
});
