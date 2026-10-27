import { randomUUID } from "node:crypto";
import sharp from "sharp";
import { createAdminClient } from "@/services/supabase/admin";

/** Logos d'entreprise (en-tête des factures) : bucket privé, lu côté serveur uniquement. */
const LOGO_BUCKET = "company-logos";
export const MAX_LOGO_UPLOAD_BYTES = 2 * 1024 * 1024;
const LOGO_MAX_WIDTH = 480;
const LOGO_MAX_HEIGHT = 160;
const ACCEPTED_FORMATS = new Set(["png", "jpeg", "webp"]);

export function isCompanyLogoPath(path: string | null | undefined, companyId: string): path is string {
  if (!path || !/^[A-Za-z0-9_-]+$/.test(companyId)) return false;
  return new RegExp(`^${companyId}/logo-[0-9a-f-]{36}\\.png$`).test(path);
}

/**
 * Vérifie que le fichier est bien une image PNG, JPEG ou WebP, puis la ramène à 480×160 au plus
 * (sans agrandir) en PNG : poids maîtrisé et format directement intégrable au PDF.
 */
export async function normalizeCompanyLogo(bytes: Buffer): Promise<{ png: Buffer; width: number; height: number }> {
  if (!bytes.length) throw new Error("LOGO_INVALID_IMAGE");
  if (bytes.length > MAX_LOGO_UPLOAD_BYTES) throw new Error("LOGO_TOO_LARGE");
  let format: string | undefined;
  try {
    format = (await sharp(bytes).metadata()).format;
  } catch {
    throw new Error("LOGO_INVALID_IMAGE");
  }
  if (!format || !ACCEPTED_FORMATS.has(format)) throw new Error("LOGO_INVALID_IMAGE");
  const { data, info } = await sharp(bytes)
    .rotate()
    .resize({ width: LOGO_MAX_WIDTH, height: LOGO_MAX_HEIGHT, fit: "inside", withoutEnlargement: true })
    .png({ compressionLevel: 9 })
    .toBuffer({ resolveWithObject: true });
  return { png: data, width: info.width, height: info.height };
}

let bucketReady: Promise<void> | null = null;

async function ensureLogoBucket() {
  if (!bucketReady) {
    bucketReady = (async () => {
      const supabase = createAdminClient();
      const { data, error } = await supabase.storage.listBuckets();
      if (error) throw new Error(`LOGO_STORAGE: ${error.message}`);
      const bucket = data?.find((item) => item.name === LOGO_BUCKET);
      if (bucket) {
        if (bucket.public) throw new Error("LOGO_STORAGE_PUBLIC");
        return;
      }
      const created = await supabase.storage.createBucket(LOGO_BUCKET, {
        public: false,
        fileSizeLimit: MAX_LOGO_UPLOAD_BYTES,
        allowedMimeTypes: ["image/png"],
      });
      if (created.error) throw new Error(`LOGO_STORAGE: ${created.error.message}`);
    })().catch((error) => { bucketReady = null; throw error; });
  }
  await bucketReady;
}

export async function uploadCompanyLogo(companyId: string, png: Buffer): Promise<string> {
  if (!/^[A-Za-z0-9_-]+$/.test(companyId)) throw new Error("LOGO_INVALID_PATH");
  await ensureLogoBucket();
  const path = `${companyId}/logo-${randomUUID()}.png`;
  const { error } = await createAdminClient().storage.from(LOGO_BUCKET).upload(path, png, {
    contentType: "image/png",
    upsert: false,
  });
  if (error) throw new Error(`LOGO_UPLOAD: ${error.message}`);
  return path;
}

export async function deleteCompanyLogoFile(path: string, companyId: string): Promise<void> {
  if (!isCompanyLogoPath(path, companyId)) throw new Error("LOGO_INVALID_PATH");
  await ensureLogoBucket();
  const { error } = await createAdminClient().storage.from(LOGO_BUCKET).remove([path]);
  if (error) throw new Error(`LOGO_DELETE: ${error.message}`);
}

/** Octets PNG du logo, ou null si absent ou illisible (la facture retombe alors sur le nom). */
export async function downloadCompanyLogo(path: string | null | undefined, companyId: string): Promise<Buffer | null> {
  if (!isCompanyLogoPath(path, companyId)) return null;
  await ensureLogoBucket();
  const { data, error } = await createAdminClient().storage.from(LOGO_BUCKET).download(path);
  if (error || !data) return null;
  return Buffer.from(await data.arrayBuffer());
}
