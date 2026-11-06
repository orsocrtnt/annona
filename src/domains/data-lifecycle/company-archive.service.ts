import { createHash, randomUUID } from "node:crypto";
import { createReadStream } from "node:fs";
import { lstat, mkdir, mkdtemp, open, realpath, rename, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import {
  createCompanyExportJsonWriter,
  visitCompanyExport,
  type CompanyExportHeader,
  type CompanyExportSummary,
  type CompanyExportVisitor,
} from "@/domains/data-lifecycle/company-export.service";
import { checkPodStorageHealth, isPodPhotoPathForDelivery, MAX_POD_BYTES } from "@/lib/storage/pod";
import { isPodSignaturePathForDelivery } from "@/lib/storage/pod-signature";

// Technical ceilings, not retention policy. Binary downloads are sequential.
export const COMPANY_ARCHIVE_LIMITS = {
  // Plafonds distincts : une photo et sa signature ne consomment pas le même quota.
  maxProofs: 1_000,
  maxSignatures: 1_000,
  maxProofBytes: MAX_POD_BYTES,
  maxTotalProofBytes: 256 * 1024 * 1024,
  // company.json is streamed page by page: this caps the file on disk, not memory.
  maxJsonBytes: 1024 * 1024 * 1024,
  downloadTimeoutMs: 30_000,
} as const;
type Limits = { [K in keyof typeof COMPANY_ARCHIVE_LIMITS]: number };
interface ArchiveOrder {
  id: string; companyId: string;
  deliveries: { id: string; companyId: string; orderId: string; podPhotoPath: string | null; podSignaturePath?: string | null }[];
}
interface Dependencies {
  visitExport: (companyId: string, visitor: CompanyExportVisitor) => Promise<CompanyExportSummary | null>;
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

// Checks the streamed graph page by page, so the whole export is never held in memory.
function createGraphGuard(companyId: string, limits: Limits) {
  const expected = new Map<string, string>();
  const counts = { photo: 0, signature: 0 };
  const orders = new Set<string>();
  const deliveries = new Set<string>();
  let started = false;
  return {
    start(header: CompanyExportHeader, company: { id: string }) {
      if (header.schema !== "annona-company-export" || header.version !== 1 || company.id !== companyId) {
        throw new Error("ARCHIVE_COMPANY_MISMATCH");
      }
      started = true;
    },
    orders(page: ArchiveOrder[]) {
      for (const order of page) {
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
            expected.set(`${delivery.id}:photo`, delivery.podPhotoPath);
            counts.photo += 1;
            if (counts.photo > limits.maxProofs) throw new Error("ARCHIVE_TOO_MANY_PROOFS");
          }
          if (delivery.podSignaturePath) {
            if (!isPodSignaturePathForDelivery(delivery.podSignaturePath, companyId, delivery.id)) {
              throw new Error("ARCHIVE_INVALID_PROOF_PATH");
            }
            expected.set(`${delivery.id}:signature`, delivery.podSignaturePath);
            counts.signature += 1;
            if (counts.signature > limits.maxSignatures) throw new Error("ARCHIVE_TOO_MANY_PROOFS");
          }
        }
      }
    },
    proofs(summary: CompanyExportSummary) {
      if (!started) throw new Error("ARCHIVE_COMPANY_MISMATCH");
      const proofs = summary.externalAssets.proofObjects;
      if (proofs.filter((proof) => proof.kind !== "signature").length > limits.maxProofs ||
        proofs.filter((proof) => proof.kind === "signature").length > limits.maxSignatures) {
        throw new Error("ARCHIVE_TOO_MANY_PROOFS");
      }
      if (expected.size !== proofs.length) throw new Error("ARCHIVE_MANIFEST_MISMATCH");
      for (const proof of proofs) {
        const key = `${proof.deliveryId}:${proof.kind ?? "photo"}`;
        if (expected.get(key) !== proof.objectKey) throw new Error("ARCHIVE_MANIFEST_MISMATCH");
        expected.delete(key);
      }
      return proofs;
    },
  };
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
    visitExport: visitCompanyExport, checkStorage: checkPodStorageHealth, download: downloadPrivateProof,
    ...options.dependencies,
  };
  const staging = await mkdtemp(join(parent, ".partial-"));
  let published = false;
  try {
    await mkdir(join(staging, "proofs"), { mode: 0o700 });
    // Validate the whole graph while writing company.json, before the first Storage read.
    const guard = createGraphGuard(companyId, limits);
    const jsonPath = join(staging, "company.json");
    const jsonFile = await open(jsonPath, "wx", 0o600);
    const jsonHash = createHash("sha256");
    let jsonBytes = 0;
    let summary: CompanyExportSummary | null;
    try {
      const writer = createCompanyExportJsonWriter(async (text) => {
        const bytes = Buffer.from(text);
        jsonBytes += bytes.byteLength;
        if (jsonBytes > limits.maxJsonBytes) throw new Error("ARCHIVE_JSON_TOO_LARGE");
        jsonHash.update(bytes);
        await jsonFile.writeFile(bytes);
      });
      summary = await dependencies.visitExport(companyId, {
        async start(header, company) {
          guard.start(header, company);
          await writer.visitor.start(header, company);
        },
        async page(collection, rows) {
          if (collection === "orders") guard.orders(rows as ArchiveOrder[]);
          await writer.visitor.page(collection, rows);
        },
      });
      if (summary) await writer.finish(summary);
      await jsonFile.sync();
    } finally { await jsonFile.close(); }
    if (!summary) throw new Error("ARCHIVE_COMPANY_NOT_FOUND");
    const proofs = guard.proofs(summary);
    const jsonSha256 = jsonHash.digest("hex");
    if (await digestFile(jsonPath) !== jsonSha256) throw new Error("ARCHIVE_INTEGRITY_FAILED");
    if (proofs.length) await dependencies.checkStorage();
    const entries: Array<{ path: string; bytes: number; sha256: string; deliveryId: string | null; kind?: "photo" | "signature" }> = [
      { path: "company.json", bytes: jsonBytes, sha256: jsonSha256, deliveryId: null },
    ];
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
        entries.push({ path: relativePath, bytes, sha256, deliveryId: proof.deliveryId, kind: proof.kind ?? "photo" });
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
      schema: "annona-company-archive", version: 1, complete: true, companyId,
      createdAt: new Date().toISOString(), algorithm: "sha256", totalProofBytes, proofCount: proofs.length,
      photoCount: proofs.filter((proof) => proof.kind !== "signature").length,
      signatureCount: proofs.filter((proof) => proof.kind === "signature").length, entries,
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
