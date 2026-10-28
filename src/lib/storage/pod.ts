import { randomUUID } from "node:crypto";
import { createAdminClient } from "@/services/supabase/admin";
import { stripPodPhotoMetadata } from "@/lib/storage/pod-image";

export const POD_BUCKET = "delivery-pods";
export const SIGNED_URL_SECONDS = 5 * 60;
export const MAX_POD_BYTES = 5 * 1024 * 1024;
export const MAX_POD_REQUEST_BYTES = MAX_POD_BYTES + 512 * 1024;
const MAX_POD_DIMENSION = 12_000;
const MAX_POD_PIXELS = 40_000_000;

export function isPodPhotoPathForDelivery(path: string, companyId: string, deliveryId: string): boolean {
  if (![companyId, deliveryId].every((id) => /^[A-Za-z0-9_-]+$/.test(id))) return false;
  const prefix = `${companyId}/${deliveryId}-`;
  return path.startsWith(prefix) && /^\d+(?:-[0-9a-f-]{36})?\.(jpg|png)$/.test(path.slice(prefix.length));
}

function validDimensions(width: number, height: number) {
  return width > 0 && height > 0 && width <= MAX_POD_DIMENSION &&
    height <= MAX_POD_DIMENSION && width * height <= MAX_POD_PIXELS;
}

export function validPng(bytes: Buffer) {
  if (bytes.length < 45 || !bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return false;
  let offset = 8;
  let sawHeader = false;
  let sawData = false;
  while (offset + 12 <= bytes.length) {
    const length = bytes.readUInt32BE(offset);
    const end = offset + 12 + length;
    if (end > bytes.length) return false;
    const type = bytes.toString("ascii", offset + 4, offset + 8);
    if (!sawHeader) {
      if (type !== "IHDR" || length !== 13) return false;
      sawHeader = validDimensions(bytes.readUInt32BE(offset + 8), bytes.readUInt32BE(offset + 12));
      if (!sawHeader) return false;
    } else if (type === "IDAT") {
      sawData = sawData || length > 0;
    } else if (type === "IEND") {
      return length === 0 && sawData && end === bytes.length;
    }
    offset = end;
  }
  return false;
}

function validJpeg(bytes: Buffer) {
  if (bytes.length < 12 || bytes[0] !== 0xff || bytes[1] !== 0xd8) return false;
  let offset = 2;
  let sawFrame = false;
  while (offset < bytes.length) {
    if (bytes[offset] !== 0xff) return false;
    while (offset < bytes.length && bytes[offset] === 0xff) offset += 1;
    const marker = bytes[offset++];
    if (marker === 0xd9) return sawFrame;
    if (marker === 0x00 || marker == null) return false;
    if (marker >= 0xd0 && marker <= 0xd7) continue;
    if (offset + 2 > bytes.length) return false;
    const length = bytes.readUInt16BE(offset);
    if (length < 2 || offset + length > bytes.length) return false;
    const isFrame = (marker >= 0xc0 && marker <= 0xc3) ||
      (marker >= 0xc5 && marker <= 0xc7) ||
      (marker >= 0xc9 && marker <= 0xcb) ||
      (marker >= 0xcd && marker <= 0xcf);
    if (isFrame) {
      if (length < 7) return false;
      sawFrame = validDimensions(bytes.readUInt16BE(offset + 3), bytes.readUInt16BE(offset + 5));
      if (!sawFrame) return false;
    }
    if (marker === 0xda) {
      for (let scan = offset + length; scan + 1 < bytes.length; scan += 1) {
        if (bytes[scan] === 0xff && bytes[scan + 1] === 0xd9) return sawFrame;
      }
      return false;
    }
    offset += length;
  }
  return false;
}

export function validatePodPhoto(bytes: Buffer, contentType: string): void {
  if (!bytes.length || bytes.length > MAX_POD_BYTES) {
    throw new Error(bytes.length > MAX_POD_BYTES ? "POD_PHOTO_TOO_LARGE" : "POD_INVALID_PHOTO");
  }
  const valid = contentType === "image/png" ? validPng(bytes) :
    contentType === "image/jpeg" ? validJpeg(bytes) : false;
  if (!valid) throw new Error("POD_INVALID_PHOTO");
}

let bucketReady: Promise<void> | null = null;

export async function checkPodStorageHealth() {
  const { data, error } = await createAdminClient().storage.getBucket(POD_BUCKET);
  if (error || !data) throw new Error("POD_STORAGE_UNAVAILABLE");
  if (data.public) throw new Error("POD_STORAGE_PUBLIC");
}

export async function ensurePodBucket() {
  if (!bucketReady) {
    bucketReady = (async () => {
      const supabase = createAdminClient();
      const { data, error } = await supabase.storage.listBuckets();
      if (error) throw new Error(`POD_STORAGE: ${error.message}`);
      const bucket = data?.find((bucket) => bucket.name === POD_BUCKET);
      if (bucket) {
        if (bucket.public) throw new Error("POD_STORAGE_PUBLIC");
        return;
      }
      const created = await supabase.storage.createBucket(POD_BUCKET, {
        public: false,
        fileSizeLimit: MAX_POD_BYTES,
        allowedMimeTypes: ["image/jpeg", "image/png"],
      });
      if (created.error) throw new Error(`POD_STORAGE: ${created.error.message}`);
    })().catch((error) => { bucketReady = null; throw error; });
  }
  await bucketReady;
}

export async function uploadPodPhoto(params: {
  companyId: string;
  deliveryId: string;
  bytes: Buffer;
  contentType: string;
}) {
  validatePodPhoto(params.bytes, params.contentType);
  if (![params.companyId, params.deliveryId].every((id) => /^[A-Za-z0-9_-]+$/.test(id))) throw new Error("POD_INVALID_PATH");
  // Aucune métadonnée (EXIF, position GPS) ne doit être conservée dans le bucket.
  const clean = await stripPodPhotoMetadata(params.bytes, params.contentType);
  await ensurePodBucket();
  const ext = params.contentType.includes("png") ? "png" : "jpg";
  const path = `${params.companyId}/${params.deliveryId}-${Date.now()}-${randomUUID()}.${ext}`;
  const supabase = createAdminClient();
  const { error } = await supabase.storage.from(POD_BUCKET).upload(path, clean, {
    contentType: params.contentType,
    upsert: false,
  });
  if (error) throw new Error(`POD_UPLOAD: ${error.message}`);
  return path;
}

export async function deletePodPhoto(path: string, companyId: string, deliveryId: string) {
  if (!isPodPhotoPathForDelivery(path, companyId, deliveryId)) throw new Error("POD_INVALID_PATH");
  await ensurePodBucket();
  const { error } = await createAdminClient().storage.from(POD_BUCKET).remove([path]);
  if (error) throw new Error(`POD_DELETE: ${error.message}`);
}

export async function cleanupPodPhotoOrphans(params: {
  companyId: string;
  deliveryId: string;
  keepPath?: string | null;
}) {
  if (![params.companyId, params.deliveryId].every((id) => /^[A-Za-z0-9_-]+$/.test(id))) {
    throw new Error("POD_INVALID_PATH");
  }
  if (params.keepPath && !isPodPhotoPathForDelivery(params.keepPath, params.companyId, params.deliveryId)) {
    throw new Error("POD_INVALID_PATH");
  }
  await ensurePodBucket();
  const storage = createAdminClient().storage.from(POD_BUCKET);
  const stale: string[] = [];
  for (let offset = 0; ; offset += 100) {
    const { data, error } = await storage.list(params.companyId, {
      limit: 100,
      offset,
      search: `${params.deliveryId}-`,
      sortBy: { column: "name", order: "asc" },
    });
    if (error) throw new Error(`POD_LIST: ${error.message}`);
    const rows = data ?? [];
    for (const row of rows) {
      const path = `${params.companyId}/${row.name}`;
      if (path !== params.keepPath && isPodPhotoPathForDelivery(path, params.companyId, params.deliveryId)) stale.push(path);
    }
    if (rows.length < 100) break;
  }
  if (stale.length) {
    const { error } = await storage.remove(stale);
    if (error) throw new Error(`POD_DELETE: ${error.message}`);
  }
  return { removed: stale.length };
}

export async function getPodPhotoSignedUrl(path: string | null | undefined, companyId: string, deliveryId: string) {
  if (!path || !isPodPhotoPathForDelivery(path, companyId, deliveryId)) return null;
  await ensurePodBucket();
  const supabase = createAdminClient();
  const { data, error } = await supabase.storage
    .from(POD_BUCKET)
    .createSignedUrl(path, SIGNED_URL_SECONDS);
  if (error || !data?.signedUrl) return null;
  return data.signedUrl;
}

/** Octets de la photo de preuve (pour le PDF). Null si le chemin n'appartient pas à cette entreprise et cette livraison. */
export async function downloadPodPhoto(path: string | null | undefined, companyId: string, deliveryId: string) {
  if (!path || !isPodPhotoPathForDelivery(path, companyId, deliveryId)) return null;
  await ensurePodBucket();
  const { data, error } = await createAdminClient().storage.from(POD_BUCKET).download(path);
  if (error || !data) return null;
  return Buffer.from(await data.arrayBuffer());
}
