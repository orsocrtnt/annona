import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { exportCompanyArchive } from "../src/domains/data-lifecycle/company-archive.service";
import type { CompanyExportSummary, CompanyExportVisitor } from "../src/domains/data-lifecycle/company-export.service";

const PHOTO = "companyA/deliveryA-123.png";
const SIGNATURE = "companyA/deliveryA-sig-1730000000000-123e4567-e89b-12d3-a456-426614174000.png";

type Delivery = { id: string; companyId: string; orderId: string; podPhotoPath: string | null; podSignaturePath: string | null };

function replay(deliveries: Delivery | Delivery[], proofObjects: Array<{ deliveryId: string; objectKey: string; kind?: string }>) {
  return async (_companyId: string, visitor: CompanyExportVisitor) => {
    const header = { schema: "tutelliv-company-export", version: 1, exportedAt: "2026-10-28T12:00:00.000Z" };
    await visitor.start(header as never, { id: "companyA" } as never);
    await visitor.page("users", []);
    await visitor.page("orders", [{ id: "orderA", companyId: "companyA", deliveries: Array.isArray(deliveries) ? deliveries : [deliveries] }] as never);
    return { ...header, counts: { orders: 1 }, externalAssets: { proofObjects } } as unknown as CompanyExportSummary;
  };
}

async function run(delivery: Delivery | Delivery[], proofObjects: Array<{ deliveryId: string; objectKey: string; kind?: string }>, limits?: Record<string, number>) {
  const parent = await mkdtemp(join(tmpdir(), "pod-sig-archive-"));
  const reads: string[] = [];
  try {
    const result = await exportCompanyArchive("companyA", parent, {
      limits,
      dependencies: {
        visitExport: replay(delivery, proofObjects),
        checkStorage: async () => undefined,
        download: async (key: string) => { reads.push(key); return new Response(`bytes:${key.includes("-sig-") ? "signature" : "photo"}`); },
      },
    });
    const manifest = JSON.parse(await readFile(join(result.path, "manifest.json"), "utf8"));
    const verify = spawnSync(process.execPath, ["scripts/data02/verify-archive.mjs", result.path, result.manifestSha256], { encoding: "utf8" });
    return { result, manifest, reads, verify, parent };
  } catch (error) {
    await rm(parent, { recursive: true, force: true });
    throw error;
  }
}

test("archive : la signature est téléchargée avec la photo, listée au manifeste et vérifiable", async () => {
  const delivery = { id: "deliveryA", companyId: "companyA", orderId: "orderA", podPhotoPath: PHOTO, podSignaturePath: SIGNATURE };
  const { result, manifest, reads, verify, parent } = await run(delivery, [
    { deliveryId: "deliveryA", objectKey: PHOTO },
    { deliveryId: "deliveryA", objectKey: SIGNATURE, kind: "signature" },
  ]);
  try {
    assert.deepEqual(reads, [PHOTO, SIGNATURE]);
    assert.equal(result.proofCount, 2);
    assert.equal(manifest.entries.length, 3);
    assert.deepEqual(manifest.entries.map((entry: { path: string }) => entry.path), ["company.json", "proofs/000001.png", "proofs/000002.png"]);
    assert.equal(await readFile(join(result.path, "proofs/000002.png"), "utf8"), "bytes:signature");
    assert.equal(verify.status, 0, verify.stderr);
  } finally { await rm(parent, { recursive: true, force: true }); }
});

test("archive : signature présente sur la livraison mais absente du manifeste d'export → refus", async () => {
  const delivery = { id: "deliveryA", companyId: "companyA", orderId: "orderA", podPhotoPath: PHOTO, podSignaturePath: SIGNATURE };
  await assert.rejects(run(delivery, [{ deliveryId: "deliveryA", objectKey: PHOTO }]), /ARCHIVE_MANIFEST_MISMATCH/);
});

test("archive : chemin de signature d'une autre entreprise ou d'une autre livraison → refus avant téléchargement", async () => {
  for (const path of ["companyB/deliveryA-sig-1730000000000-123e4567-e89b-12d3-a456-426614174000.png", "companyA/deliveryB-sig-1730000000000-123e4567-e89b-12d3-a456-426614174000.png", "companyA/deliveryA-123.png"]) {
    const delivery = { id: "deliveryA", companyId: "companyA", orderId: "orderA", podPhotoPath: null, podSignaturePath: path };
    await assert.rejects(run(delivery, [{ deliveryId: "deliveryA", objectKey: path, kind: "signature" }]), /ARCHIVE_INVALID_PROOF_PATH/);
  }
});

test("archive : une livraison sans signature produit le même archive qu'avant", async () => {
  const delivery = { id: "deliveryA", companyId: "companyA", orderId: "orderA", podPhotoPath: PHOTO, podSignaturePath: null };
  const { result, reads, verify, parent } = await run(delivery, [{ deliveryId: "deliveryA", objectKey: PHOTO }]);
  try {
    assert.equal(result.proofCount, 1);
    assert.deepEqual(reads, [PHOTO]);
    assert.equal(verify.status, 0, verify.stderr);
  } finally { await rm(parent, { recursive: true, force: true }); }
});

const sigPath = (id: string) => `companyA/${id}-sig-1730000000000-123e4567-e89b-12d3-a456-426614174000.png`;
const photoPath = (id: string) => `companyA/${id}-123.png`;
const delivery = (id: string, withPhoto = true, withSignature = true): Delivery => ({
  id, companyId: "companyA", orderId: "orderA", podPhotoPath: withPhoto ? photoPath(id) : null, podSignaturePath: withSignature ? sigPath(id) : null,
});

test("archive : photos et signatures ont chacune leur plafond ; une photo et sa signature ne consomment pas le même quota", async () => {
  const both = delivery("deliveryA");
  const objects = [{ deliveryId: "deliveryA", objectKey: photoPath("deliveryA") }, { deliveryId: "deliveryA", objectKey: sigPath("deliveryA"), kind: "signature" }];
  const { result, parent } = await run(both, objects, { maxProofs: 1, maxSignatures: 1 });
  try { assert.equal(result.proofCount, 2); } finally { await rm(parent, { recursive: true, force: true }); }

  const twoSignatures = [delivery("deliveryA", false), delivery("deliveryB", false)];
  const signatureObjects = twoSignatures.map((d) => ({ deliveryId: d.id, objectKey: sigPath(d.id), kind: "signature" }));
  await assert.rejects(run(twoSignatures, signatureObjects, { maxSignatures: 1 }), /ARCHIVE_TOO_MANY_PROOFS/);
  const twoPhotos = [delivery("deliveryA", true, false), delivery("deliveryB", true, false)];
  await assert.rejects(run(twoPhotos, twoPhotos.map((d) => ({ deliveryId: d.id, objectKey: photoPath(d.id) })), { maxProofs: 1, maxSignatures: 5 }), /ARCHIVE_TOO_MANY_PROOFS/);
});

test("archive : le manifeste indique le type de chaque pièce et les comptes par type", async () => {
  const both = delivery("deliveryA");
  const { manifest, parent } = await run(both, [{ deliveryId: "deliveryA", objectKey: photoPath("deliveryA") }, { deliveryId: "deliveryA", objectKey: sigPath("deliveryA"), kind: "signature" }]);
  try {
    assert.deepEqual(manifest.entries.map((entry: { kind?: string }) => entry.kind), [undefined, "photo", "signature"]);
    assert.equal(manifest.proofCount, 2);
    assert.equal(manifest.photoCount, 1);
    assert.equal(manifest.signatureCount, 1);
  } finally { await rm(parent, { recursive: true, force: true }); }
});
