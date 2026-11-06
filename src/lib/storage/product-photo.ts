import { randomUUID } from "node:crypto";
import sharp from "sharp";
import { createAdminClient } from "@/services/supabase/admin";

/**
 * Photos des produits du catalogue (ADM-02, CLI-03) : bucket privé Supabase Storage, lu côté serveur
 * seulement et servi par l'API aux utilisateurs de la même entreprise (PLA-01). Même principe que
 * les logos d'entreprise (`company-logo.ts`).
 */
const PHOTO_BUCKET = "product-photos";
export const MAX_PRODUCT_PHOTO_UPLOAD_BYTES = 5 * 1024 * 1024;
const PHOTO_MAX_SIDE = 640;
const ACCEPTED_FORMATS = new Set(["png", "jpeg", "webp"]);
const SAFE_ID = /^[A-Za-z0-9_-]+$/;

export function isProductPhotoPath(path: string | null | undefined, companyId: string): path is string {
  if (!path || !SAFE_ID.test(companyId)) return false;
  return new RegExp(`^${companyId}/[A-Za-z0-9_-]+-[0-9a-f-]{36}\\.webp$`).test(path);
}

/** Vérifie l'image (PNG, JPEG, WebP), la ramène à 640 px de côté au plus, en WebP. */
export async function normalizeProductPhoto(bytes: Buffer): Promise<Buffer> {
  if (!bytes.length) throw new Error("PHOTO_INVALID_IMAGE");
  if (bytes.length > MAX_PRODUCT_PHOTO_UPLOAD_BYTES) throw new Error("PHOTO_TOO_LARGE");
  let format: string | undefined;
  try {
    format = (await sharp(bytes).metadata()).format;
  } catch {
    throw new Error("PHOTO_INVALID_IMAGE");
  }
  if (!format || !ACCEPTED_FORMATS.has(format)) throw new Error("PHOTO_INVALID_IMAGE");
  return sharp(bytes)
    .rotate()
    .resize({ width: PHOTO_MAX_SIDE, height: PHOTO_MAX_SIDE, fit: "inside", withoutEnlargement: true })
    .webp({ quality: 80 })
    .toBuffer();
}

let bucketReady: Promise<void> | null = null;

async function ensurePhotoBucket() {
  if (!bucketReady) {
    bucketReady = (async () => {
      const supabase = createAdminClient();
      const { data, error } = await supabase.storage.listBuckets();
      if (error) throw new Error(`PHOTO_STORAGE: ${error.message}`);
      const bucket = data?.find((item) => item.name === PHOTO_BUCKET);
      if (bucket) {
        if (bucket.public) throw new Error("PHOTO_STORAGE_PUBLIC");
        return;
      }
      const created = await supabase.storage.createBucket(PHOTO_BUCKET, {
        public: false,
        fileSizeLimit: MAX_PRODUCT_PHOTO_UPLOAD_BYTES,
        allowedMimeTypes: ["image/webp"],
      });
      if (created.error) throw new Error(`PHOTO_STORAGE: ${created.error.message}`);
    })().catch((error) => {
      bucketReady = null;
      throw error;
    });
  }
  await bucketReady;
}

export async function uploadProductPhoto(companyId: string, productId: string, webp: Buffer): Promise<string> {
  if (!SAFE_ID.test(companyId) || !SAFE_ID.test(productId)) throw new Error("PHOTO_INVALID_PATH");
  await ensurePhotoBucket();
  const path = `${companyId}/${productId}-${randomUUID()}.webp`;
  const { error } = await createAdminClient().storage.from(PHOTO_BUCKET).upload(path, webp, {
    contentType: "image/webp",
    upsert: false,
  });
  if (error) throw new Error(`PHOTO_UPLOAD: ${error.message}`);
  return path;
}

export async function deleteProductPhotoFile(path: string, companyId: string): Promise<void> {
  if (!isProductPhotoPath(path, companyId)) throw new Error("PHOTO_INVALID_PATH");
  await ensurePhotoBucket();
  const { error } = await createAdminClient().storage.from(PHOTO_BUCKET).remove([path]);
  if (error) throw new Error(`PHOTO_DELETE: ${error.message}`);
}

export async function downloadProductPhoto(path: string | null | undefined, companyId: string): Promise<Buffer | null> {
  if (!isProductPhotoPath(path, companyId)) return null;
  await ensurePhotoBucket();
  const { data, error } = await createAdminClient().storage.from(PHOTO_BUCKET).download(path);
  if (error || !data) return null;
  return Buffer.from(await data.arrayBuffer());
}
