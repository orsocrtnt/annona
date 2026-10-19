import { createHash, randomUUID } from "node:crypto";
import { createReadStream } from "node:fs";
import { lstat, mkdir, mkdtemp, open, realpath, rename, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { exportCompanyData } from "@/domains/data-lifecycle/company-export.service";
import { checkPodStorageHealth, isPodPhotoPathForDelivery, MAX_POD_BYTES } from "@/lib/storage/pod";

// Technical ceilings, not retention policy. Binary downloads are sequential.
export const COMPANY_ARCHIVE_LIMITS = {
  maxProofs: 1_000,
  maxProofBytes: MAX_POD_BYTES,
  maxTotalProofBytes: 256 * 1024 * 1024,
  maxJsonBytes: 10 * 1024 * 1024,
  downloadTimeoutMs: 30_000,
} as const;
type Limits = { [K in keyof typeof COMPANY_ARCHIVE_LIMITS]: number };
export interface CompanyArchiveSnapshot {
  schema: string;
  version: number;
  externalAssets: { proofObjects: { deliveryId: string; objectKey: string }[] };
  data: {
    company: { id: string };
    orders: { id: string; companyId: string; deliveries: {
      id: string; companyId: string; orderId: string; podPhotoPath: string | null;
    }[] }[];
  };
}
interface Dependencies {
  exportData: (companyId: string) => Promise<CompanyArchiveSnapshot | null>;
  checkStorage: () => Promise<void>;
  download: (objectKey: string, signal: AbortSignal) => Promise<Response>;
}

async function downloadPrivateProof(objectKey: string, signal: AbortSignal) {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!base || !key) throw new Error("ARCHIVE_STORAGE_UNCONFIGURED");
  // Same authenticated object endpoint as storage-js; fetch avoids buffering its Blob.
  const url = new URL(`/storage/v1/object/delivery-pods/${objectKey}`, base);
  return fetch(url, {
    headers: { apikey: key, Authorization: `Bearer ${key}`, "Accept-Encoding": "identity" },
    signal, redirect: "error", cache: "no-store",
  });
}

function validateSnapshot(snapshot: CompanyArchiveSnapshot, companyId: string, limits: Limits) {
  if (snapshot.schema !== "tutelliv-company-export" || snapshot.version !== 1 ||
      snapshot.data.company.id !== companyId) throw new Error("ARCHIVE_COMPANY_MISMATCH");
  const expected = new Map<string, string>();
  const orders = new Set<string>();
  const deliveries = new Set<string>();
  for (const order of snapshot.data.orders) {
    if (order.companyId !== companyId || orders.has(order.id)) throw new Error("ARCHIVE_ORDER_MISMATCH");
    orders.add(order.id);
    for (const delivery of order.deliveries) {
      if (delivery.companyId !== companyId || delivery.orderId !== order.id || deliveries.has(delivery.id)) {
        throw new Error("ARCHIVE_DELIVERY_MISMATCH");
      }
      deliveries.add(delivery.id);
      if (delivery.podPhotoPath !== null) {
        if (!isPodPhotoPathForDelivery(delivery.podPhotoPath, companyId, delivery.id)) {
          throw new Error("ARCHIVE_INVALID_PROOF_PATH");
        }
        expected.set(delivery.id, delivery.podPhotoPath);
      }
    }
  }
  const proofs = snapshot.externalAssets.proofObjects;
  if (proofs.length > limits.maxProofs) throw new Error("ARCHIVE_TOO_MANY_PROOFS");
  if (expected.size !== proofs.length) throw new Error("ARCHIVE_MANIFEST_MISMATCH");
  for (const proof of proofs) {
    if (expected.get(proof.deliveryId) !== proof.objectKey) throw new Error("ARCHIVE_MANIFEST_MISMATCH");
    expected.delete(proof.deliveryId);
  }
  return proofs;
}

async function digestFile(path: string) {
  const hash = createHash("sha256");
  for await (const bytes of createReadStream(path)) hash.update(bytes);
  return hash.digest("hex");
}

/** Internal operator service only. No route, public link or generic deletion. */
export async function exportCompanyArchive(
  companyId: string,
  privateParent: string,
  options: { limits?: Partial<Limits>; dependencies?: Partial<Dependencies> } = {},
) {
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(companyId)) throw new Error("ARCHIVE_INVALID_COMPANY");
  const limits = { ...COMPANY_ARCHIVE_LIMITS, ...options.limits };
  for (const name of Object.keys(limits) as (keyof Limits)[]) {
    if (!Number.isSafeInteger(limits[name]) || limits[name] <= 0 || limits[name] > COMPANY_ARCHIVE_LIMITS[name]) {
      throw new Error("ARCHIVE_INVALID_LIMIT");
    }
  }
  const parent = await realpath(privateParent);
  const parentStat = await lstat(parent);
  if (!parentStat.isDirectory() || (parentStat.mode & 0o077) !== 0 || parentStat.uid !== process.getuid?.()) {
    throw new Error("ARCHIVE_PARENT_NOT_PRIVATE");
  }
  const dependencies = {
    exportData: exportCompanyData, checkStorage: checkPodStorageHealth, download: downloadPrivateProof,
    ...options.dependencies,
  };
  const snapshot = await dependencies.exportData(companyId);
  if (!snapshot) throw new Error("ARCHIVE_COMPANY_NOT_FOUND");
  // Validate the whole graph before the first Storage read, including deliveries without photos.
  const proofs = validateSnapshot(snapshot, companyId, limits);
  const json = JSON.stringify(snapshot, null, 2) + "\n";
  if (Buffer.byteLength(json) > limits.maxJsonBytes) throw new Error("ARCHIVE_JSON_TOO_LARGE");
  if (proofs.length) await dependencies.checkStorage();
  const staging = await mkdtemp(join(parent, ".partial-"));
  let published = false;
  try {
    await mkdir(join(staging, "proofs"), { mode: 0o700 });
    await writeFile(join(staging, "company.json"), json, { mode: 0o600, flag: "wx" });
    const entries = [{ path: "company.json", bytes: Buffer.byteLength(json), sha256: await digestFile(join(staging, "company.json")), deliveryId: null as string | null }];
    let totalProofBytes = 0;
    for (const [index, proof] of proofs.entries()) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), limits.downloadTimeoutMs);
      let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
      try {
        const response = await dependencies.download(proof.objectKey, controller.signal);
        if (!response.ok || !response.body) {
          await response.body?.cancel();
          throw new Error(response.status === 404 ? "ARCHIVE_PROOF_MISSING" : "ARCHIVE_DOWNLOAD_FAILED");
        }
        reader = response.body.getReader();
        const length = response.headers.get("content-length");
        const declared = length === null ? null : Number(length);
        if (declared !== null && (!/^\d+$/.test(length!) || !Number.isSafeInteger(declared) || declared <= 0 ||
          declared > limits.maxProofBytes || declared > limits.maxTotalProofBytes - totalProofBytes)) {
          throw new Error("ARCHIVE_PROOF_SIZE_LIMIT");
        }
        const relativePath = `proofs/${String(index + 1).padStart(6, "0")}.${proof.objectKey.endsWith(".png") ? "png" : "jpg"}`;
        const destination = join(staging, relativePath);
        const file = await open(destination, "wx", 0o600);
        let bytes = 0;
        const hash = createHash("sha256");
        try {
          for (;;) {
            const chunk = await reader.read();
            if (chunk.done) break;
            bytes += chunk.value.byteLength;
            totalProofBytes += chunk.value.byteLength;
            if (bytes > limits.maxProofBytes || totalProofBytes > limits.maxTotalProofBytes) {
              throw new Error("ARCHIVE_PROOF_SIZE_LIMIT");
            }
            hash.update(chunk.value);
            await file.writeFile(chunk.value);
          }
          if (bytes === 0 || (declared !== null && bytes !== declared)) throw new Error("ARCHIVE_PROOF_TRUNCATED");
          await file.sync();
        } finally { await file.close(); }
        const sha256 = hash.digest("hex");
        if (await digestFile(destination) !== sha256) throw new Error("ARCHIVE_INTEGRITY_FAILED");
        entries.push({ path: relativePath, bytes, sha256, deliveryId: proof.deliveryId });
      } catch (error) {
        if (controller.signal.aborted) throw new Error("ARCHIVE_DOWNLOAD_TIMEOUT");
        // Do not expose provider URLs, signed query parameters or response bodies.
        if (error instanceof Error && /^ARCHIVE_[A-Z_]+$/.test(error.message)) throw error;
        throw new Error("ARCHIVE_DOWNLOAD_FAILED");
      } finally {
        controller.abort();
        await reader?.cancel().catch(() => undefined);
        clearTimeout(timeout);
      }
    }
    const manifest = {
      schema: "tutelliv-company-archive", version: 1, complete: true, companyId,
      createdAt: new Date().toISOString(), algorithm: "sha256", totalProofBytes, proofCount: proofs.length, entries,
    };
    await writeFile(join(staging, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n", { mode: 0o600, flag: "wx" });
    const manifestSha256 = await digestFile(join(staging, "manifest.json"));
    const path = join(parent, `company-archive-${randomUUID()}`);
    await rename(staging, path);
    published = true;
    return { path, manifestSha256, proofCount: proofs.length, totalProofBytes };
  } finally {
    if (!published) await rm(staging, { recursive: true, force: true });
  }
}
